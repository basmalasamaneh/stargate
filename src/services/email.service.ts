import nodemailer from "nodemailer";
import { Resend } from "resend";

const resend = new Resend(process.env["RESEND_API_KEY"]);

// Create Nodemailer Transporter (for Gmail or other SMTP)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env["EMAIL_USER"], // Your gmail address
    pass: process.env["EMAIL_PASS"], // Your gmail App Password
  },
});

export const sendOtpEmail = async (email: string, firstName: string, otp: string) => {
  const isGmailSetup = process.env["EMAIL_USER"] && process.env["EMAIL_PASS"];

  try {
    if (isGmailSetup) {
      // Use Nodemailer/Gmail
      await transporter.sendMail({
        from: `"Athar | أثر" <${process.env["EMAIL_USER"]}>`,
        to: email,
        subject: "رمز التحقق لمتجر أثر",
        html: getHtmlTemplate(firstName, otp),
      });
      return { success: true, method: "nodemailer" };
    } else {
      // Use Resend (Fallback or Default)
      const { data, error } = await resend.emails.send({
        from: "Athar <onboarding@resend.dev>", 
        to: [email],
        subject: "رمز التحقق لمتجر أثر",
        html: getHtmlTemplate(firstName, otp),
      });

      if (error) {
        console.warn("Resend is in 'Sandbox Mode'. Email was NOT sent, but you can use the code below:");
        console.log("-----------------------------------------");
        console.log(`🔑 DEV OTP for ${email}: ${otp}`);
        console.log("-----------------------------------------");
        // We don't throw an error here so the signup process can finish
        return { success: false, error: error.message };
      }

      return data;
    }
  } catch (err) {
    console.error("Email Service Error (Console OTP Logged):", err);
    console.log("-----------------------------------------");
    console.log(`🔑 DEV OTP for ${email}: ${otp}`);
    console.log("-----------------------------------------");
    // We don't throw an error here so the signup process can finish
    return { success: false, error: "Email delivery failed" };
  }
};

const getHtmlTemplate = (firstName: string, otp: string) => `
  <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0d5c8; border-radius: 15px; background-color: #fcfaf8;">
    <h1 style="color: #3b2012; text-align: center;">مرحباً ${firstName}!</h1>
    <p style="color: #5c3d2e; font-size: 18px; text-align: center;">شكراً لانضمامك إلى أثر. يرجى استخدام الرمز التالي لتفعيل حسابك:</p>
    <div style="background-color: #3b2012; color: #ffffff; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 30px auto; width: 200px; border-radius: 10px; letter-spacing: 5px;">
      ${otp}
    </div>
    <p style="color: #9c7b65; font-size: 14px; text-align: center;">هذا الرمز صالح لمدة 10 دقائق فقط.</p>
    <hr style="border: 0; border-top: 1px solid #e0d5c8; margin: 30px 0;">
    <p style="color: #bcaaa0; font-size: 12px; text-align: center;">إذا لم تقم بإنشاء حساب في أثر، يرجى تجاهل هذا البريد.</p>
  </div>
`;
