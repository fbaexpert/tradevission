# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Important: Configure Password Reset Email

To make the "Forgot Password" feature work correctly, you need to configure the email template in your Firebase project. This is a **MANDATORY ONE-TIME SETUP**.

1.  Go to the **Firebase Console** for your project.
2.  In the left menu, go to **Build** > **Authentication**.
3.  Click on the **Templates** tab at the top.
4.  In the list, find the **Password Reset** template and click the pencil icon to edit it.
5.  Near the bottom, click the **"Customize action URL"** link.
6.  A dialog box will appear. Paste the following URL into the text box.

    **IMPORTANT:** You MUST replace `tradevision-82417` with your actual Firebase Project ID if it's different. You can find your project ID in the Firebase Console project settings (click the gear icon ⚙️ next to "Project Overview"). The final domain should be `your-project-id.web.app`, NOT `tradevission.online`. The `.web.app` domain is the default hosting domain that Firebase uses for these links.

    ```
    https://tradevision-82417.web.app/reset-password
    ```

7.  Click **Save**.

After this change, the password reset links sent to your users will correctly point to your application's password reset page. Without this step, the links will not work.
