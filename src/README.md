# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Important: Configure Password Reset Email (MANDATORY FIX)

To make the "Forgot Password" feature work correctly, you **MUST** configure the email template in your Firebase project. This is a one-time setup. Without this, the password reset link will NOT work.

### Step 1: Open Firebase Console

Go to the **Firebase Console** for your project: [https://console.firebase.google.com/](https://console.firebase.google.com/)

### Step 2: Go to Authentication Templates

1.  In the left menu, go to **Build** > **Authentication**.
2.  Click on the **Templates** tab at the top.
3.  In the list of email templates, find **Password Reset** and click the pencil icon ✏️ to edit it.



### Step 3: Customize Action URL

1.  Near the bottom of the template editor, click the link that says **"Customize action URL"**.
2.  A dialog box will appear. **DELETE** any existing URL and paste the following URL into the text box.

    ```
    https://tradevision-82417.web.app/reset-password
    ```

    **VERY IMPORTANT:**
    *   The domain **MUST** be your project's default domain (`<your-project-id>.web.app`), **NOT** your custom domain (`tradevission.online`). Firebase generates authentication links using this default domain.
    *   Ensure your Project ID (`tradevision-82417`) in the URL is correct. You can find your Project ID in your project's settings (click the gear icon ⚙️ next to "Project Overview").



### Step 4: Save the Template

Click the **Save** button at the bottom of the page.

After performing these steps, the password reset links sent to your users will correctly point to your application's password reset page.
