import { POSTCARD_CONFIG } from "$lib";
import dedent from "dedent";
import { Resend } from "resend";


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

      return resend.emails.send({ 
        from: POSTCARD_CONFIG.support_email, 
        to: emailTo, 
        subject: subject, 
        text: plainText 
      });
    },
    sendMagicLinkEmail: async (emailTo: string, url: string) => {
      const plainText = dedent(`
        Hi,

        Click this link to verify your wrks.zip subscription: ${url}

        This link is valid for a short time. If you did not request this, you can safely ignore this email.

        If you need help, contact ${POSTCARD_CONFIG.support_email}

        Best,
        Paprika @ reberrymemberer.com
      `);
      const subject = 'Sign-up to Reberrymemberer';
      return resend.emails.send({ 
        from: POSTCARD_CONFIG.support_email, 
        to: emailTo, 
        subject, 
        text: plainText 
      });
    },
    sendOtpToEmail: async (emailTo: string, codeOTP: string) => {
      const plainText = dedent(`
        Hi,

        Your one-time verification code is: ${codeOTP}

        This code is valid for a short time. If you did not request this, you can safely ignore this email.

        If you need help, contact ${POSTCARD_CONFIG.support_email}

        Best,
        Paprika @ reberrymemeber
      `);
      const subject = 'Sign-in to Reberrymemberer';
      return resend.emails.send({
        from: POSTCARD_CONFIG.support_email,
        to: emailTo,
        subject: subject,
        text: plainText
      });
    },
    sendFriendInvitation: async (emailTo: string, senderEmail: string, inviteUrl: string) => {
      const plainText = dedent(`
        Hi,

        ${senderEmail} has invited you to be friends on Reberrymemberer!

        Being friends allows you to send postcards to each other without sharing your full addresses. Only your name and country will be visible.

        Click this link to accept the invitation: ${inviteUrl}

        This link will expire in 7 days.

        If you need help, contact ${POSTCARD_CONFIG.support_email}

        Best,
        Paprika @ reberrymemberer.com
      `);
      const subject = `${senderEmail} invited you to be friends on Reberrymemberer`;
      return resend.emails.send({
        from: POSTCARD_CONFIG.support_email,
        to: emailTo,
        subject: subject,
        text: plainText
      });
    }
  }
}