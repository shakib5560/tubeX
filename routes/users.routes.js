import { Router} from "express";
import {registerUser} from "../controllers/users.controller.js";

const router = Router();
router.route("/register")
    .get((req, res) => {
        res.json({ message: "GET register working" });
    })
    .post(registerUser);


export default router;