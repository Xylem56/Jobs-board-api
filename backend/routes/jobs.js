const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate, authorizeRole } = require("../middleware/auth");


router.post ("/jobs", authenticate, authorizeRole("employer"), async (req, res) => {
    const {title, description, location, salary, job_type} = req.body;
    
    if (!title || !description || !location || !salary || !job_type) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        const employer = await pool.query("SELECT id FROM companies WHERE user_id = $1", [req.user.id]);
        if (employer.rows.length === 0) {
            return res.status(400).json({ message: "Employer not found." });
        }
        const companyId = employer.rows[0].id;
        const newJob = await pool.query(
        
            "INSERT INTO jobs (company_id, title, description, location, salary, job_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [companyId, title, description, location, salary, job_type]
        );
        res.status(201).json({ id: newJob.rows[0].id });
    } catch (error) {
        console.error("Error creating job:", error);
        res.status(500).json({ message: "Internal server error." });
    }
    
})

router.get("/jobs", async (req, res) => {
    const {location, job_type} = req.query;
    
    try {
        let query = "SELECT jobs.id, companies.company_name, jobs.title, jobs.description, jobs.location, jobs.salary, jobs.job_type FROM jobs JOIN companies ON jobs.company_id = companies.id WHERE 1=1";
        const params = [];
        let paramIndex = 1;

        if (location) {
            query += ` AND jobs.location ILIKE $${paramIndex}`;
            params.push(`%${location}%`);
            paramIndex++;
        }
        if (job_type) {
            query += ` AND jobs.job_type = $${paramIndex}`;
            params.push(job_type);
            paramIndex++;
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

router.get("/jobs/:id", async (req, res) => {
    const {id} = req.params;
    try {
        const result = await pool.query(
            "SELECT jobs.id, companies.company_name, jobs.title, jobs.description, jobs.location, jobs.salary, jobs.job_type FROM jobs JOIN companies ON jobs.company_id = companies.id WHERE jobs.id = $1",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Job not found." });
        }
        res.json(result.rows[0]);

         
    } catch (error)  {
        console.error("Error fetching job:", error);
        res.status(500).json({ message: "Internal server error." });
    }
    
});

router.put("/jobs/:id", authenticate, authorizeRole("employer"), async (req, res) => {
      const {id} = req.params;
      const {title, description, location, salary, job_type} = req.body;
      try {
        const employer = await pool.query("SELECT id FROM companies WHERE user_id = $1", [req.user.id]);
        if (employer.rows.length === 0) {
            return res.status(400).json({ message: "Employer not found." });
        }
        const companyId = employer.rows[0].id;
        const job = await pool.query("SELECT * FROM jobs WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (job.rows.length === 0) {
            return res.status(403).json({ message: "Forbidden. You do not have permission to edit this job." });
        }
        await pool.query (
            `UPDATE jobs SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            location = COALESCE($3, location),
            salary = COALESCE($4, salary),
            job_type = COALESCE($5, job_type)
            WHERE id = $6`,
            [title, description, location, salary, job_type, id]
        );
        res.json({ message: "Job updated successfully." });
      } catch (error) {
        console.error("Error updating job:", error);
        res.status(500).json({ message: "Internal server error." });
      }
});

router.delete("/jobs/:id", authenticate, authorizeRole("employer"), async (req, res) => {
    const { id} = req.params;
    try{
        const employer = await pool.query("SELECT id FROM companies WHERE user_id = $1", [req.user.id]);
        if (employer.rows.length === 0) {
            return res.status(400).json({ message: "Employer not found." });
        }
        const companyId = employer.rows[0].id;
        const job = await pool.query("SELECT * FROM jobs WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (job.rows.length === 0) {
            return res.status(403).json({ message: "Forbidden. You do not have permission to delete this job." });
        }
        await pool.query("DELETE FROM jobs WHERE id = $1", [id]);
        res.json({ message: "Job deleted successfully." });

    } catch (error) {
        console.log("Error deleting job:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

router.get("/jobs", async (req, res) => {

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            "SELECT jobs.id, companies.company_name, jobs.title, jobs.description, jobs.location, jobs.salary, jobs.job_type FROM jobs JOIN companies ON jobs.company_id = companies.id ORDER BY jobs.created_at DESC LIMIT $1 OFFSET $2",
            [limit, offset]
        );
        res.json(result.rows);
    } catch (err) {
    console.log(err)
    res.status(500).json({message: "Error fetching jobs"})
    }


})


router.post("/jobs/:id/apply", authenticate, authorizeRole("seeker"), async (req, res) => {
    const {id} = req.params; 
    const {cv_id} = req.body;

    try {
        const job = await pool.query ("SELECT id FROM jobs WHERE id = $1", [id]);
        if (job.rows.length === 0) {
            return res.status(404).json ({message: "Job not found."});
        }

        await pool.query ("INSERT INTO applications (job_id, user_id) VALUES ($1, $2)", [id, req.user.id]);
        res.json({ message: "Application submitted successfully." });

    } catch (error) {
        console.error("Error applying for job:", error);
        res.status(500).json({message: "Internal server error"});
    }

    });

    router.get("/jobs/applications/mine", authenticate, authorizeRole("seeker"), async (req, res) => {
        try {
            const application = await pool.query("SELECT * FROM applications WHERE user_id =$1", [req.user.id]);
            res.json(application.rows);

        } catch (error) {
            console.error("Error fetching applications:", error);
            res.status(500).json({ message: "Internal server error." });
        }
    }); 

    router.get("/jobs/:id/applications", authenticate, authorizeRole("employer"), async (req, res) => {
        const {id}= req.params;
        try { 
            const employer = await pool.query ("SELECT id FROM companies WHERE user_id= $1", [req.user.id]);
            if (employer.rows.length ===0 ) {
                return res.status(400).json ({ message: " EMployer not found."});

            }
            const companyId = employer.rows[0].id;
            const jobs = await pool.query( " SELECT id FROM jobs WHERE company_id = $1", [companyId]);
            const jobIds = jobs.rows.map(job => job.id);
            if (!jobIds.includes(parseInt(id))) {
                return res.status(403).json({ message: "Forbidden. You do not have permission to view applications for this job." });
            }
            const applications = await pool.query(
                "SELECT applications.id, users.full_name AS seeker_name, applications.status FROM applications JOIN users ON applications.user_id = users.id WHERE applications.job_id = $1",
                [id]
            );
            res.json(applications.rows);

        } catch (error) {
            console.log("Error fetching applications:", error);
            res.status(500).json ({ message: "Inernal server error."});
        }
    })

    router.post("/jobs/apply/cv-creation", authenticate, authorizeRole("seeker"), async (req, res) => {
        const {full_name, email, phone, education, experience, skills} = req.body;
        if (!full_name || !email || !phone || !education || !experience || !skills) {
            return res.status(400).json({ message: "All fields are required." });
        }
        try {
           const count = await pool.query(
                    "SELECT COUNT(*) FROM cvs WHERE user_id = $1",
                    [req.user.id]
                    );
                    if (parseInt(count.rows[0].count) >= 3) {
                    return res.status(400).json({ message: "CV limit reached. Delete an existing CV to create a new one." });
                    }

            const result = await pool.query(
                "INSERT INTO cvs (user_id, full_name, email, phone, education, experience, skills) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
                [req.user.id, full_name, email, phone, education, experience, skills]
            );
            res.json({ message: "CV created successfully.", cv_id: result.rows[0].id });


        } catch (error) {
            console.log(error)
            return res.status(500).json({message: "Error while creating your Cv"})
        }
    })

    router.get("/cvs/mine", authenticate, authorizeRole("seeker"), async (req, res) => {
        
        try {
            const cvs = await pool.query("SELECT id, full_name, email, phone, education, experience, skills FROM cvs WHERE user_id = $1", [req.user.id]);
            res.json(cvs.rows);
        } catch (err) {
            res.status(500).json({message: "An error occured while processing your request."})
        }

    });

    router.delete("/cvs/:id", authenticate, authorizeRole("seeker"), async (req, res) => {
        const {id} = req.params;
     try {
        const cv = await pool.query("SELECT * FROM cvs WHERE id = $1 AND user_id = $2", [id, req.user.id]);
     if (cv.rows.length===0) {
        return res.status(403).json ({message: "CV not found or you don't have permission to delete it"})

     }

     await pool.query("DELETE FROM cvs WHERE id = $1", [id]);
     res.json({message: " Cv deleted successfully"});

     }

  
        catch (error) {
        console.log("Error deleting Cv:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});




module.exports = router;