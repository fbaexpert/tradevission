# How to Publish This Project to GitHub

Follow these steps exactly to connect and upload your project to your new GitHub account.

**IMPORTANT:** Before you start, go to your GitHub account and create a **new, empty repository**. Do NOT add a README or .gitignore file from the GitHub interface.

After you create the repository, copy its HTTPS URL. It will look like this: `https://github.com/your-username/your-repository-name.git`

---

### Step 1: Initialize the Git Repository

Run this command to turn your project folder into a Git repository.

```bash
git init -b main
```

---

### Step 2: Add and Commit Your Files

These commands will save a snapshot of your project.

```bash
git add .
git commit -m "Initial commit"
```

---

### Step 3: Connect to Your GitHub Repository

Replace the URL with your own repository URL that you copied from GitHub.

```bash
git remote add origin https://github.com/your-username/your-repository-name.git
```

---

### Step 4: Push Your Code

This is the final step to upload your code.

```bash
git push -u origin main
```

When it asks for your **Username**, type your GitHub username.

When it asks for your **Password**, **paste your new Personal Access Token (PAT)**.

If you follow these steps, your project will be successfully published to your new GitHub account.
