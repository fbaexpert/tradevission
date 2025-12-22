# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Important: Configure Password Reset Email

To make the "Forgot Password" feature work correctly, you need to configure the email template in your Firebase project.

1.  Go to the **Firebase Console**.
2.  Navigate to **Authentication** > **Templates** tab.
3.  Select the **Password Reset** template.
4.  Click the pencil icon to edit it.
5.  Click on the "Customize action URL" link.
6.  Paste the following URL into the text box. **IMPORTANT: Make sure to replace `tradevision-82417` with your actual Firebase Project ID if it's different.** You can find your project ID in the Firebase Console project settings.

    ```
    https://tradevision-82417.web.app/auth/action
    ```

7.  Save the template.

After this change, the password reset links sent to your users will correctly point to your application's new password reset page.
