//require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";

import {app} from "./app.js"

dotenv.config({
    path: './.env'
})

connectDB()
.then( () => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`@Server is running at port : ${process.env.PORT}`);
        
    })
})
.catch((err) => {
    console.log("MONGODB FAILED TO CONNECT !!!", err);
})
/*
import express from "express"
const app = express()


( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", () => {
            console.log("ERRR ", error);
            throw error
        })

        app.listen(pocess.env.PORT, () => {
            console.log(`APP is listening on PORT ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR: ", error)
        throw err
    }
})()
*/