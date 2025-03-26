

const corsPolicy ={
    origin: ["https://vite-app-str4.onrender.com", "http://localhost:5173"],
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    credentials: true,
}


module.exports = corsPolicy