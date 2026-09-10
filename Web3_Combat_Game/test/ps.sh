#!/bin/sh
for p in /proc/[0-9]*/cmdline; do
  printf "%s: " "$p"
  tr '\0' ' ' < "$p" 2>/dev/null
  echo
done | head -25