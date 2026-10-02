#!/usr/bin/env bash
# Package the app as a minified .xdc (zip) file for sharing in Delta Chat.
# Supports two modes:
#   1. Default: stage from project root (index.html) while respecting IGNORE_LIST
#   2. --from-dist / -d : package the already-built contents of dist/ (after pnpm build)
set -euo pipefail

# ==============================================================================
# IGNORE LIST: Directories, files, and wildcard patterns to exclude (root mode)
# ==============================================================================
IGNORE_LIST=(
  "temp"
  "git-assets"
  ".git"
  ".github"
  "node_modules"
  "src"
  "dist"
  ".aistudio"
  "README.md"
  "metadata.json"
  "package*.json"
  "bun.lock"
  "pnpm-lock.yaml"
  "package-lock.json"
  "yarn.lock"
  "tsconfig.json"
  "vite.config.ts"
  "vite.config.js"
  "*.sh"
  "*.py"
  "*.cjs"
  "*.tsx"
  ".env*"
  "*.xdc"
  ".gitignore"
  ".npmrc"
  ".pnpmfile.cjs"
)

# ==============================================================================
# Locate project root containing index.html (or dist/index.html)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURRENT_DIR="$(pwd)"
PROJECT_ROOT=""
for candidate in "$SCRIPT_DIR" "$(dirname "$SCRIPT_DIR")" "$CURRENT_DIR" "$(dirname "$CURRENT_DIR")"; do
  if [ -f "$candidate/index.html" ] || [ -f "$candidate/dist/index.html" ]; then
    PROJECT_ROOT="$(cd "$candidate" && pwd)"
    break
  fi
done
if [ -z "$PROJECT_ROOT" ]; then
  echo "Error: Could not find project root (index.html or dist/index.html not found)." >&2
  exit 1
fi
cd "$PROJECT_ROOT"

# Parse arguments
VERBOSE=false
MINIFY=false
FROM_DIST=false
OUT="temp/app.xdc"
for arg in "$@"; do
  case "$arg" in
    -v|--verbose)
      VERBOSE=true
      ;;
    -m|--minify)
      MINIFY=true
      ;;
    -d|--from-dist)
      FROM_DIST=true
      ;;
    -h|--help)
      cat << 'HELP_EOF'
WebXDC (.xdc) Packaging Tool

Usage:
  ./make-xdc.sh [output_path.xdc] [options]

Options:
  -m, --minify     Enable minification for HTML, CSS, JS, and JSON files.
  -d, --from-dist  Package from the dist/ directory (use after "pnpm build").
  -v, --verbose    Verbose mode: prints detailed file staging and processing logs.
  -h, --help       Show this help message and exit.

Examples:
  ./make-xdc.sh                          Fast packaging (unminified) at temp/app.xdc
  ./make-xdc.sh build.xdc --minify       Package with minification at build.xdc
  ./make-xdc.sh -d -m                    Package minified build from dist/
  ./make-xdc.sh app.xdc -d -m -v         Minified dist packaging with verbose logs
HELP_EOF
      exit 0
      ;;
    *)
      if [[ "$arg" != -* ]]; then
        OUT="$arg"
      fi
      ;;
  esac
done

STAGE_DIR="temp/_stage_$$"
SRC_DIR="$STAGE_DIR/src"
DIST_DIR="$STAGE_DIR/dist"

# Ensure cleanup on exit
trap 'rm -rf "$STAGE_DIR"' EXIT INT TERM
mkdir -p "$(dirname "$OUT")" "$SRC_DIR" "$DIST_DIR"
ABS_OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
rm -f "$ABS_OUT"

if [ "$FROM_DIST" = true ]; then
  # ------------------------------------------------------------------
  # Mode: package from existing dist/ (after pnpm / npm / vite build)
  # ------------------------------------------------------------------
  if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "Error: --from-dist requested but dist/index.html not found." >&2
    echo "Run 'pnpm build' (or equivalent) first." >&2
    exit 1
  fi

  [ "$VERBOSE" = true ] && echo "==> Staging files from dist/..."
  # Copy everything from dist/ into staging (no IGNORE_LIST needed)
  cp -r dist/. "$SRC_DIR/"

  # Also pull in root-level files that must live next to index.html in the .xdc
  # (manifest.toml, icon.png / icon.jpg) if they were not emitted by the build.
  for extra in manifest.toml icon.png icon.jpg; do
    if [ -f "$extra" ] && [ ! -f "$SRC_DIR/$extra" ]; then
      [ "$VERBOSE" = true ] && echo "  + $extra (from project root)"
      cp "$extra" "$SRC_DIR/"
    fi
  done
else
  # ------------------------------------------------------------------
  # Mode: classic root packaging with IGNORE_LIST
  # ------------------------------------------------------------------
  [ "$VERBOSE" = true ] && echo "==> Staging files from $PROJECT_ROOT..."
  for item in * .[^.]*; do
    [ -e "$item" ] || continue
    skip=false
    for ex in "${IGNORE_LIST[@]}"; do
      if [[ "$item" == $ex ]]; then
        skip=true
        break
      fi
    done
    if [ "$skip" = false ]; then
      [ "$VERBOSE" = true ] && echo "  + $item"
      cp -r "$item" "$SRC_DIR/"
    fi
  done
fi

# Clean up macOS junk / AI studio leftovers
rm -rf "$SRC_DIR/assets/.aistudio" "$SRC_DIR"/**/.DS_Store 2>/dev/null || true

# 2. Process assets (Default unminified vs Minified)
if [ "$MINIFY" = true ]; then
  # Safely Minify HTML, CSS, JS, and JSON files ONLY
  # Binary files (.png, .gz, .woff2, .ico, etc.) are copied byte-for-byte
  echo "==> Minifying HTML, CSS, JS, and JSON assets..."
  node - "$SRC_DIR" "$DIST_DIR" "$VERBOSE" << 'EOF'
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const [,, srcDir, distDir, verboseStr] = process.argv;
const isVerbose = verboseStr === 'true';

// Strictly allow minification ONLY for text web asset extensions
const MINIFY_EXTENSIONS = new Set(['.html', '.css', '.js', '.json']);

function copyAndMinify(src, dist) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const distPath = path.join(dist, entry.name);
    if (entry.isDirectory()) {
      copyAndMinify(srcPath, distPath);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      // STRICT CHECK: Only process as text if extension is explicitly in MINIFY_EXTENSIONS
      if (MINIFY_EXTENSIONS.has(ext)) {
        let minified = false;
        if (ext === '.js') {
          try {
            execSync(`npx --yes terser "${srcPath}" -o "${distPath}" --compress --mangle`, { stdio: 'ignore' });
            minified = true;
          } catch (e) {
            try {
              let code = fs.readFileSync(srcPath, 'utf8');
              code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*/gm, '').replace(/\n\s*\n/g, '\n').trim();
              fs.writeFileSync(distPath, code, 'utf8');
              minified = true;
            } catch (err) {}
          }
        } else if (ext === '.css') {
          try {
            execSync(`npx --yes clean-css-cli -o "${distPath}" "${srcPath}"`, { stdio: 'ignore' });
            minified = true;
          } catch (e) {
            try {
              let css = fs.readFileSync(srcPath, 'utf8');
              css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').replace(/;\}/g, '}').trim();
              fs.writeFileSync(distPath, css, 'utf8');
              minified = true;
            } catch (err) {}
          }
        } else if (ext === '.html') {
          try {
            execSync(`npx --yes html-minifier-terser --collapse-whitespace --remove-comments --minify-css true --minify-js true "${srcPath}" -o "${distPath}"`, { stdio: 'ignore' });
            minified = true;
          } catch (e) {
            try {
              let html = fs.readFileSync(srcPath, 'utf8');
              html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
              fs.writeFileSync(distPath, html, 'utf8');
              minified = true;
            } catch (err) {}
          }
        } else if (ext === '.json') {
          try {
            const raw = fs.readFileSync(srcPath, 'utf8');
            const parsed = JSON.parse(raw);
            fs.writeFileSync(distPath, JSON.stringify(parsed), 'utf8');
            minified = true;
          } catch (e) {}
        }
        // If minifier tool failed, copy original file intact
        if (!minified) {
          fs.copyFileSync(srcPath, distPath);
        } else if (isVerbose) {
          console.log(`  minified: ${path.relative(srcDir, srcPath)}`);
        }
      } else {
        // BINARY FILES (.png, .gz, .woff, .woff2, .ttf, .ico, .webp, .toml, etc.)
        // ALWAYS use fs.copyFileSync to guarantee 100% binary fidelity!
        fs.copyFileSync(srcPath, distPath);
        if (isVerbose) {
          console.log(`  copied (binary/raw): ${path.relative(srcDir, srcPath)}`);
        }
      }
    }
  }
}
copyAndMinify(srcDir, distDir);
EOF
else
  echo "==> Packaging without minification (default)..."
  cp -r "$SRC_DIR/." "$DIST_DIR/"
fi

# 3. Create .xdc zip archive
echo "==> Creating $OUT..."
if command -v zip >/dev/null 2>&1; then
  (cd "$DIST_DIR" && zip -q -9 -r "$ABS_OUT" .)
else
  (cd "$DIST_DIR" && python3 -c "
import os, zipfile, sys
out = sys.argv[1]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, _, files in os.walk('.'):
        for f in files:
            path = os.path.join(root, f)
            zf.write(path, path)
" "$ABS_OUT")
fi

FILE_SIZE=$(ls -lh "$ABS_OUT" | awk '{print $5}')
echo "========================================="
echo "Successfully created $OUT ($FILE_SIZE)"
echo "All temporary files cleaned up."
echo "========================================="
