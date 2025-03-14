# AWE Project

This project consists of a React frontend and a Flask backend.

## Project Structure

- `frontend/`: React application
- `backend/`: Flask API

## Setup Instructions

### Prerequisites
- Node.js and npm for the frontend
- Python 3.x for the backend
- Git

## Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2 and 3 :
Dont create venv 
     ```

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Run the Flask application:
   ```
   flask run
   ```
   or
   ```
   python app.py
   ```

## Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:


   ```

   npm install




   npm install react@18 react-dom@18 @emotion/react @emotion/styled date-fns@2.29.3 @mui/material @mui/system @mui/styled-engine @mui/icons-material @mui/x-date-pickers


   npm start
   ```

3. Start the development server:
   ```
   npm start
   ```

## Git Instructions

### For Team Members (Cloning the Repository)

To clone this repository:
```bash
git clone <repository-url>
cd awe
```

### Creating a New Branch

1. Fetch the latest updates and switch to the `main` branch:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Create a new branch for your work:
   ```bash
   git checkout -b feature-branch-name
   ```
   Replace `feature-branch-name` with a meaningful name related to your work.

### Making Changes & Committing Code

1. Modify the code as needed.
2. Check the changes made:
   ```bash
   git status
   ```
3. Stage the changes:
   ```bash
   git add .
   ```
4. Commit the changes with a meaningful message:
   ```bash
   git commit -m "Your descriptive commit message"
   ```

### Pushing Changes

1. Push your branch to the remote repository:
   ```bash
   git push origin feature-branch-name
   ```

### Creating a Pull Request (PR)

1. Go to the repository on GitHub.
2. Navigate to the **Pull Requests** tab.
3. Click **New Pull Request**.
4. Select your branch and compare it with `main`.
5. Add a title and description explaining your changes.
6. Click **Create Pull Request**.
7. Wait for review and approval before merging.

After merging, make sure to pull the latest changes into your local `main` branch:
```bash
git checkout main
git pull origin main
```

