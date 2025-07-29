# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a gym class booking automation bot built with TypeScript and Playwright. The bot automatically books gym classes at specific times based on a predefined schedule. It targets a Taiwanese gym chain and handles the entire booking flow from login to class selection.

## Development Commands

- `npm run build` - Compile TypeScript to JavaScript in the dist/ directory
- `npm run start` - Build and run the compiled bot (runs npm run build first)
- `npm run prestart` - Explicitly build the project (called automatically by start)

## Architecture and Code Structure

### Core Components

1. **Main Entry Point**: `index.ts` - Contains the entire automation logic as a single async IIFE
2. **Configuration Section**: 
   - `TARGET_GYM_BRANCH`: Hardcoded gym branch name
   - `CLASS_SCHEDULE`: Array of classes to book with day, name, time, and classroom
   - Environment variables: `USERNAME`, `PASSWORD`, `LOGIN_URL` from `.env` file

### Key Logic Components

1. **Time Management Functions**:
   - `getNextClassDateTime()`: Calculates the next occurrence of a scheduled class
   - `isNextWeek()`: Determines if a class falls in the next calendar week (Monday-Sunday)
   - Week logic assumes Monday=start of week for the gym's booking system

2. **Booking Window Logic**:
   - Classes can be booked 72 hours before class time
   - Booking window closes 1 hour before class time
   - Script only runs automation when within the booking window

3. **Browser Automation Flow**:
   - Uses Playwright with Chromium in non-headless mode
   - Logs into gym website using form submission
   - Navigates to class search page
   - Selects gym branch, week (current/next), and classroom
   - Finds specific class in weekly schedule grid
   - Handles booking overlay iframe
   - Has safety mechanism - actual booking is commented out

### Dependencies

- **Playwright**: Browser automation for the booking process
- **dotenv**: Environment variable management for credentials
- **Express**: Listed as dependency but not used in current code
- **TypeScript**: Full TypeScript setup with strict mode enabled

## Environment Setup

The bot requires a `.env` file with:
- `USERNAME`: Gym account username
- `PASSWORD`: Gym account password  
- `LOGIN_URL`: URL to the gym's login page

## Safety Features

- The actual booking button click is commented out by default
- Screenshots are taken on errors and saved as `error_screenshot.png`
- Comprehensive logging throughout the automation process
- Validates booking window timing before attempting to book

## Browser Automation Notes

- Uses iframe handling for the booking overlay
- Implements explicit waits for network idle states
- Handles dynamic content loading with scrolling
- Uses Chinese text selectors matching the gym website's interface
- Includes verification steps to ensure correct selections