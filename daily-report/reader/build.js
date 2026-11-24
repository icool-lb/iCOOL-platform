// node reader/build.js → reader/index.html (published as the claude.ai artifact «قارئ أوراق iCOOL»)
const fs = require("fs"), path = require("path");
const P = require("./prompts.js");
const t = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");
const logo = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "..", "logo.png")).toString("base64");
const out = t.replace("__LOGO__", logo).replace("__PROMPTS__", JSON.stringify({ SITE: P.SITE, DAYLOG: P.DAYLOG }).replace(/</g, "\\u003c"));
fs.writeFileSync(path.join(__dirname, "index.html"), out);
console.log("ok", out.length);
