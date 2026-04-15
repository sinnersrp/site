require("dotenv").config();

const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");

const connectDB = require("./config/db");
const User = require("./models/User");

const authRoutes = require("./routes/auth");
const pageRoutes = require("./routes/pages");
const apiRoutes = require("./routes/api");

const app = express();

connectDB();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  })
);

app.use(async (req, res, next) => {
  try {
    req.user = null;

    if (req.session?.userId) {
      const user = await User.findById(req.session.userId);
      req.user = user || null;
    }

    req.isAuthenticated = () => !!req.user;
    res.locals.user = req.user || null;

    next();
  } catch (error) {
    console.error("Erro ao carregar sessão do usuário:", error);
    req.user = null;
    req.isAuthenticated = () => false;
    res.locals.user = null;
    next();
  }
});

app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/", pageRoutes);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Página não encontrada",
    user: req.user || null,
    message: "A página que você tentou acessar não existe."
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Site rodando na porta ${PORT}`);
});