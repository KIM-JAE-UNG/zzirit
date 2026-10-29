#!/usr/bin/env bash
# Runs every check: database rules (PGlite), the website against a fake Supabase, the Claude page against a fake runtime.
# Needs Node 18+, Python 3 and Playwright with Chromium (`require('playwright')` must work).
# Screenshots land in tests/out/ (not committed). Exit code is non-zero if anything fails.
set -u
cd "$(dirname "$0")"
[ -d node_modules/@electric-sql/pglite ] && [ -d node_modules/leaflet ] && [ -d node_modules/qrcode-generator ] || npm install --no-audit --no-fund --silent
(cd .. && python3 build.py) || exit 1
# both pages must at least parse (a stray quote in a translation once broke the whole website)
node -e 'const fs=require("fs");let bad=0;for(const f of ["../index.html","../artifact.html"]){const h=fs.readFileSync(f,"utf8");for(const m of h.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)){try{new Function(m[1])}catch(e){console.log("SYNTAX ERROR in "+f+": "+e.message);bad=1}}}process.exit(bad)' || { echo "SOME CHECKS FAILED (the built page does not parse)"; exit 1; }
fail=0
echo "== database rules"; node db/rules.test.mjs | tail -3; [ "${PIPESTATUS[0]}" = 0 ] || fail=1
echo "== live database before the reset"; node db/before-reset.test.mjs | tail -1; [ "${PIPESTATUS[0]}" = 0 ] || fail=1
echo "== phone notices: database"; node db/push.test.mjs | tail -1; [ "${PIPESTATUS[0]}" = 0 ] || fail=1
echo "== phone notices: encryption (RFC 8291)"; node push/webpush.test.mjs | tail -1; [ "${PIPESTATUS[0]}" = 0 ] || fail=1
echo "== live chat, 1:1, leaving: database"; node db/chat.test.mjs | tail -1; [ "${PIPESTATUS[0]}" = 0 ] || fail=1
node web/server.js > out-web-server.log 2>&1 & WS=$!
node claude/server.js > out-claude-server.log 2>&1 & CS=$!
trap 'kill $WS $CS 2>/dev/null; rm -f out-web-server.log out-claude-server.log' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8768/index.html && curl -s -o /dev/null http://127.0.0.1:8766/_test.html && break; sleep 0.3; done
echo "== website"; node web/run.js > out-web.txt 2>&1; grep -v 'Failed to load resource' out-web.txt | grep -E '✗|CRASH|PAGEERROR|ALL PASSED|FAILED'; grep -q 'ALL PASSED' out-web.txt || fail=1
echo "== Claude page"; node claude/run.js > out-claude.txt 2>&1; grep -E '✗|CRASH|PAGEERROR|ALL PASSED|FAILED' out-claude.txt; grep -q 'ALL PASSED' out-claude.txt || fail=1
# registering a catch on a phone (incl. logging in halfway): on a fresh fake server, where these photos are new
kill $WS 2>/dev/null; sleep 0.3; node web/server.js > out-web-server.log 2>&1 & WS=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8768/index.html && break; sleep 0.3; done
echo "== phone: registering a catch"; node web/phone-scan.js > out-phone.txt 2>&1; grep -E '✗|CRASH|PAGEERROR|ALL PASSED|FAILED' out-phone.txt; grep -q 'ALL PASSED' out-phone.txt || fail=1
# several people at once: the open chat, 1:1, the park and a duel, the operator's board tools, leaving — on a fresh fake server
kill $WS 2>/dev/null; sleep 0.3; node web/server.js > out-web-server.log 2>&1 & WS=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8768/index.html && break; sleep 0.3; done
echo "== live: chat, park, duels, board, leaving"; node web/live.js > out-live.txt 2>&1; grep -E '✗|CRASH|PAGEERROR|ALL PASSED|FAILED' out-live.txt; grep -q 'ALL PASSED' out-live.txt || fail=1
mkdir -p out && mv -f out-web.txt out-claude.txt out-phone.txt out-live.txt out/ 2>/dev/null
[ $fail = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED (details in tests/out/)"
exit $fail
