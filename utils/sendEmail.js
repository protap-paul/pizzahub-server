
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
    try {
        const isProduction = process.env.NODE_ENV === "production";

        // Development mode: Send test emails to verified address
        const recipient = isProduction
            ? to
            : process.env.RESEND_TEST_EMAIL || to;

        const emailSubject = isProduction
            ? subject
            : `[TEST] ${subject}`;

        const { data, error } = await resend.emails.send({
            from: "PizzaHub <onboarding@resend.dev>",
            to: recipient,
            subject: emailSubject,
            html,
        });

        if (error) {
            console.error("Email sending failed:", error);
            return false;
        }

        console.log("Email sent successfully:", data.id);
        console.log("Email recipient:", recipient);

        return true;
    } catch (error) {
        console.error("Email Service Error:", error);
        return false;
    }
};
