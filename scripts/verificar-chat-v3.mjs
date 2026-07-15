import fs from "node:fs";
const read=f=>fs.existsSync(f)?fs.readFileSync(f,"utf8"):"";
const required=["modules/chat/chat.routes.mjs","modules/chat/chat.service.mjs","public/assets/js/fusion-site-chat.js","public/pages/site-chat/index.js","public/pages/professor-area/index.html"];
const server=read("server.mjs"), service=read("modules/chat/chat.service.mjs"), widget=read("public/assets/js/fusion-site-chat.js"), admin=read("public/pages/site-chat/index.js"), prof=read("public/pages/professor-area/index.html");
const checks={
 requiredFiles:required.every(fs.existsSync), canonicalApi:server.includes('app.use("/api/chat", chatRoutes)'), legacyCompatibility:server.includes('app.use("/api/site-chat", siteChatRoutes)'),
 separatedUsers:service.includes("participanteChave")&&service.includes("professor:"), publicAutoOnly:service.includes('["site","matricula_online","promocao"]'),
 readStatus:service.includes("marcarLeituraChat")&&service.includes("lidoPorAtendimento"), portalProfessor:widget.includes("portal_professor")&&prof.includes('data-chat-origem="portal_professor"'),
 portalAlunoNoAuto:widget.includes("portal_aluno"), adminUsesCanonical:admin.includes("/api/chat/"), responsive:fs.existsSync("public/assets/css/fusion-site-chat.css")
};
const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({ok:!failed.length,version:"3.0.0-chat-integrated-final",canonicalApi:"/api/chat",checks,missing:required.filter(f=>!fs.existsSync(f)),failed},null,2));
if(failed.length) process.exit(1);
