// scripts/fill-placeholders.js
// Recorre app/ y llena con contenido mínimo válido cualquier
// page.js, layout.js o route.js que esté vacío (0 bytes).
// Uso: node scripts/fill-placeholders.js

const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(process.cwd(), "app");

function humanNameFromPath(filePath) {
  const parts = filePath.split(path.sep);
  const idx = parts.lastIndexOf("app");
  const relevant = parts.slice(idx + 1, -1); // sin "app" y sin el archivo
  const label = relevant.filter((p) => p !== "api" && p !== "dashboard").join(" / ");
  return label || "Página";
}

function templateForPage(filePath) {
  const label = humanNameFromPath(filePath);
  return `export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-800">${label || "Pendiente"}</h1>
      <p className="text-sm text-gray-500 mt-2">Esta sección está en construcción.</p>
    </div>
  );
}
`;
}

function templateForLayout() {
  return `export default function Layout({ children }) {
  return <>{children}</>;
}
`;
}

function templateForRoute() {
  return `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, message: "Endpoint pendiente de implementar" });
}
`;
}

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function run() {
  if (!fs.existsSync(APP_DIR)) {
    console.error("No se encontró la carpeta app/. Ejecuta este script desde la raíz del proyecto.");
    process.exit(1);
  }

  const allFiles = walk(APP_DIR);
  let filled = 0;

  for (const filePath of allFiles) {
    const fileName = path.basename(filePath);
    const isTargetFile =
      fileName === "page.js" || fileName === "layout.js" || fileName === "route.js";

    if (!isTargetFile) continue;

    const stats = fs.statSync(filePath);
    if (stats.size > 0) continue; // ya tiene contenido, no lo tocamos

    let content;
    if (fileName === "page.js") content = templateForPage(filePath);
    else if (fileName === "layout.js") content = templateForLayout();
    else if (fileName === "route.js") content = templateForRoute();

    fs.writeFileSync(filePath, content, "utf8");
    filled += 1;
    console.log(`✓ Rellenado: ${path.relative(process.cwd(), filePath)}`);
  }

  console.log(`\nListo. ${filled} archivo(s) rellenados con placeholders válidos.`);
}

run();