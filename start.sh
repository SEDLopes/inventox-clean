#!/bin/bash
# Railway start script for InventoX

# Ensure uploads directory exists with correct permissions
mkdir -p uploads
chmod 755 uploads

# Start Apache in foreground
apache2-foreground
