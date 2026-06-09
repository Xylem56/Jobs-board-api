const express = require ("express");
const router = express.Router();
const jwt = require ("jsonwebtoken");
const bcrypt = require ("bcryptjs");
const pool = require ("../db");
const crypto = require ("crypto");
const nodemailer = require ("nodemailer");

router.post("/register", async (req, res) => {
    const { full_name, email, password, role, company_name} = req.body;
     
    const validRoles = ["employer", "seeker"];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role. Role must be selected from 'employer' or 'seeker'."})
    }
    
    if (role === "employer" && !company_name) {
        return res.status(400).json({ message: "Company name is required for users with the 'employer' role."})

    }
    if (role === "seeker" && !full_name) {
        return res.status(400).json({ message: "Full name is required for users with the 'seeker' role." })
    }
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }
    try {
        const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Email already exists." });
        }

         const hashPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
        "INSERT INTO users (full_name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role",
        [full_name, email, hashPassword, role]
        );
        const user = newUser.rows[0];

        if (role === "employer") {
            await pool.query(
                "INSERT INTO companies (user_id, company_name) VALUES ($1, $2)",
                [user.id, company_name]
            );

        }
     const token = jwt.sign(
        {id: user.id, role: user.role},
        process.env.JWT_SECRET,
        {expiresIn: "10h"}
     );
     return res.status(201).json({ message: " Registratin successful", token,
        user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
        },
     });

    } catch (err) {
        console.log(err);
        return res.status(500).json({"Server error": "An error occurred while processing your request."});
    }

});

router.post("/login", async (req, res) => {
    const {email, password} = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required."})

    }
    try {
        const existingUser = await pool.query("SELECT id, full_name, email, password, role FROM users WHERE email = $1", [email])
        if (existingUser.rows.length === 0) {
            return res.status(400).json({ message: "Invalid email or password."})
    
    }
    const user = existingUser.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid credentials."})
    }
    const token = jwt.sign(
        {id: user.id, role: user.role},
        process.env.JWT_SECRET,
        {expiresIn: "2h"}
        );
        return res.status(200).json({ message: "Login successful", token, user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
        }
    });
     
    } catch(err) {
        console.log(err);
        return res.status(500).json({ message: "An error occurred while processing your request." })
    }

    })

    router.post("/forgot-password", async (req, res) => {
        const {email} = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required"})
        }
        try {
            const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
            if (existingUser.rows.length === 0) {
                return res.status(400).json({ message: "Email not found."})
            }
            // we generate a password reset token and send it to the user's email address
            const resetToken = crypto.randomBytes(32).toString("hex");
            const resetTokenExpiry = new Date(Date.now() + 3600000); // token expires in 1 hour

            await pool.query(
                "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3",
                [resetToken, resetTokenExpiry, email]
            );
            const transporter = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
            const resetLink = `http://localhost:3000/auth/reset-password/${resetToken}`;

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Password Reset Request",
                html: `<p>You requested a password reset.</p>
                <p> Click <a href="${resetLink}">here</a> to reset your password.</p>`
            });

    
            return res.status(200).json({ message: "Password reset token generated and sent to email."})
        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "An error occurred while processing your request."})
        }
    })

    router.post("/reset-password", async (req, res) => {
        const { resetToken, newPassword } = req.body;
    
      if (!resetToken || !newPassword) {
            return res.status(400).json({message: "Reset token and new password are required."})
        } try {
                const existingUser = await pool.query(
                    "SELECT id, reset_token_expiry FROM users WHERE reset_token = $1",
                    [resetToken]
                );
                if (existingUser.rows.length === 0) {
                    return res.status(400).json({ message: "Invalid reset token."})
                }
                const user = existingUser.rows[0];
                if (user.reset_token_expiry < new Date()) {
                    return res.status(400).json({ message: "Reset token has expired."})
                }
                const hashPassword = await bcrypt.hash(newPassword, 10);
                await pool.query(
                    "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
                    [hashPassword, user.id]
                );
                return res.status(200).json({ message: "Password has been reset successfully."})
                } catch (err){
                    return res.status(500).json({message: " An error occured while processing your request."})

                }


            
    })
/*
    router.get("/profile",  async (req, res) => {

        try {
            const user = await pool.query("SELECT id, full_name, email, role FROM users WHERE id = $1", [req.user.id]);
            if (user.rows.length === 0) {
                return res.status(404).json({ message: "User not found."})
            }
            res.json(user.rows[0]);

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "An error occurred while processing your request."})
        }
    })
        */


module.exports = router;