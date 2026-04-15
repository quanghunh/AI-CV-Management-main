# Recruit AI Project

**Recruit AI Project 2** is a full-stack web application that automatically parses resumes (CVs) and matches them with job postings using AI 

## Tech Stack

| Layer             | Technology                           |
| ----------------- | ------------------------------------ |
| **Frontend**      | React + Vite + TailwindCSS           |
| **Backend**       | FastAPI (Python)                     |
| **AI Engine**     | OpenRouter API (GPT models) + Gemini +... |
| **File Parsing**  | PyPDF2, python-docx                  |
| **Communication** | Axios + REST API                     |

---

## Installation Guide

### 1. Clone Repository


git clone https://github.com/quanghunh/AI-CV-Management-main.git
cd AI-CV-Management-main.git

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


cd src

####  Install Dependencies

npm install react react-dom vite axios react-router-dom lucide-react tailwindcss autoprefixer postcss @headlessui/react @heroicons/react

npm install i18next react-i18next i18next-browser-languagedetector


#### (Optional Dev Dependencies)


npm install -D eslint prettier typescript @types/react @types/react-dom


#### Run Frontend


npm run dev

The web app runs at **[http://localhost:5173](http://localhost:5173)** by default.

## Author
**Nguyễn Trung Hậu**
**Huỳnh Nhật Quang**
GitHub: [leobigboy](https://github.com/leobigboy)
GitHub: [quanghuynh](https://github.com/quanghunh)


---
