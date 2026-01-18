# Recruit AI Project 2 — CV Management Platform

## Overview

**Recruit AI Project 2** is a full-stack web application that automatically parses resumes (CVs) and matches them with job postings using V0 AI and OpenRouter API with supabase database. The platform consists of a **FastAPI backend** and a **React (Vite) frontend**.

---

## Features

* Upload and parse CVs in **PDF** or **DOCX** format.
* Use **OpenRouter AI (GPT-4o-mini)** to extract structured information from CVs.
* Match parsed CVs with job descriptions using AI.
* View candidate strengths, weaknesses, and overall match scores.
* Cross-origin ready with full CORS configuration.
* Clean API design with FastAPI and JSON-based responses.

---

## Tech Stack

| Layer             | Technology                           |
| ----------------- | ------------------------------------ |
| **Frontend**      | React + Vite + TailwindCSS           |
| **Backend**       | FastAPI (Python)                     |
| **AI Engine**     | OpenRouter API (GPT models) + Gemini |
| **File Parsing**  | PyPDF2, python-docx                  |
| **Communication** | Axios + REST API                     |

---

## Installation Guide

### 1. Clone Repository


git clone https://github.com/leobigboy/recruit-ai-project2.git
cd recruit-ai-project2


---

### 2. Backend Setup (FastAPI)

#### Navigate to backend folder


cd backend


#### Install Dependencies


pip install fastapi uvicorn python-multipart python-dotenv requests PyPDF2 python-docx pydantic aiofiles


#### (Optional) Create `requirements.txt`

fastapi
uvicorn
python-multipart
python-dotenv
requests
PyPDF2
python-docx
pydantic
aiofiles


Then install with:


pip install -r requirements.txt


####  Run Backend Server


python main.py


Server will start at: **[http://localhost:8000](http://localhost:8000)**

---

### 3. Frontend Setup (React + Vite)

####  Navigate to frontend folder


cd frontend


####  Install Dependencies


npm install react react-dom vite axios react-router-dom lucide-react tailwindcss autoprefixer postcss @headlessui/react @heroicons/react

npm install i18next react-i18next i18next-browser-languagedetector


#### (Optional Dev Dependencies)


npm install -D eslint prettier typescript @types/react @types/react-dom


#### Run Frontend


npm run dev


The web app runs at **[http://localhost:5173](http://localhost:5173)** by default.

---

## Environment Variables

Create a `.env` file in your backend root with:


OPENROUTER_API_KEY=your_openrouter_api_key_here


---

## API Endpoints

### 🔹 Root

`GET /` → Returns API status and version.

### 🔹 Health Check

`GET /health` → Confirms API and OpenRouter configuration.

### 🔹 Parse CV

`POST /api/parse-cv`

* Upload a CV file (`.pdf` or `.docx`)
* Extracts text + structured info via AI.

### 🔹 Match CV with Jobs

`POST /api/match-cv-jobs`

* Sends parsed CV + job list
* Returns best match, strengths, weaknesses, and score.

---

## Folder Structure


recruit-ai-project2/
│
├── backend/
│   ├── main.py               # FastAPI
│   ├── .env                  # API key
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── README.md


---

## Example Commands Summary

| Purpose                | Command                           |
| ---------------------- | --------------------------------- |
| Start backend          | `uvicorn main:app --reload`       |
| Start frontend         | `npm run dev`                     |
| Install backend deps   | `pip install -r requirements.txt` |
| Install frontend deps  | `npm install`                     |
| Create Tailwind config | `npx tailwindcss init -p`         |

---

## Example `.env`


OPENROUTER_API_KEY=sk-your-key


---

## Notes

* The project integrates with **OpenRouter AI**, so make sure the API key is valid.
* Only **PDF** and **DOCX** are supported for CV parsing.
* The backend returns JSON responses — frontend uses **Axios** to consume them.

---

## Author

**Võ Huỳnh Thái Bảo**
**Nguyễn Trung Hậu**
**Huỳnh Nhật Quang**
GitHub: [leobigboy](https://github.com/leobigboy)

---