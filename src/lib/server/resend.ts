import dedent from "dedent";
import { Resend } from "resend";

// Constants
const EMAIL_SUPPORT = "reberrymemberer@paprika.fyi";


export function initResend(apiKey: string) {
  const resend = new Resend(apiKey);
  return {
    sendConfirmationEmail: async (emailTo: string, orderId: string) => {
      const plainText = dedent(`
        Hi,

        We’ve received your postcard order.
        
        It’s being prepared for printing and delivery.

        Order Id: ${orderId}

        Best,
        Paprika @ reberrymemberer.com
      `);
      const subject = 'Your postcard is on its way';

      return resend.emails.send({ from: EMAIL_SUPPORT, to: emailTo, subject: subject, text: plainText });
    },
    sendEmailVerLink: async (emailTo: string, url: string) => {
      const plainText = dedent(`
        Hi,

        Click this link to verify your wrks.zip subscription: ${url}

        This link is valid for a short time. If you did not request this, you can safely ignore this email.

        If you need help, contact ${EMAIL_SUPPORT}

        Best,
        Paprika @ reberrymemberer.com
      `);
      const subject = 'Sign-up to Reberrymemberer';

      return resend.emails.send({ from: EMAIL_SUPPORT, to: emailTo, subject, text: plainText });
    }
  }
}