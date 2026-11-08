@echo off

setlocal

deno run --check -A make.ts %*
