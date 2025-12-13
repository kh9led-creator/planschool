import emailjs from '@emailjs/browser';

// Configuration for EmailJS
// You should get these from your EmailJS dashboard: https://www.emailjs.com/
// For security, strictly use Environment Variables in production.
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_id_placeholder'; 
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_id_placeholder';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_placeholder';

export const sendActivationEmail = async (email: string, schoolName: string, code: string, type: 'registration' | 'renewal'): Promise<boolean> => {
    
    // Check if keys are configured, otherwise fall back to simulation
    const isConfigured = EMAILJS_SERVICE_ID !== 'service_id_placeholder';

    if (!isConfigured) {
        console.warn('EmailJS keys not found in .env. Falling back to simulation mode.');
        return simulateEmail(email, schoolName, code, type);
    }

    try {
        console.log(`[Email Service] Sending real email to ${email}...`);
        
        const templateParams = {
            to_email: email,
            to_name: schoolName,
            subject: type === 'registration' ? 'تفعيل حساب المدرسة' : 'تجديد الاشتراك',
            message: `
                مرحباً مدير مدرسة ${schoolName}،
                
                ${type === 'registration' ? 'شكراً لتسجيلكم.' : 'طلب تجديد الاشتراك.'}
                كود التفعيل الخاص بك هو: ${code}
            `,
            code: code, // Assuming your template has a {{code}} variable
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
        console.log('[Email Service] Email sent successfully!');
        return true;

    } catch (error) {
        console.error('[Email Service] Failed to send email:', error);
        alert('فشل إرسال البريد الإلكتروني الحقيقي. تأكد من إعدادات EmailJS.');
        return false;
    }
};

const simulateEmail = async (email: string, schoolName: string, code: string, type: 'registration' | 'renewal'): Promise<boolean> => {
    return new Promise((resolve) => {
        console.log(`[Email Service - SIMULATION] Connecting to SMTP server...`);
        setTimeout(() => {
            console.log(`
            =================================================
            [SIMULATED EMAIL - CONSOLE OUTPUT]
            TO: ${email}
            SUBJECT: ${type === 'registration' ? 'تفعيل حساب المدرسة' : 'تجديد الاشتراك'}
            -------------------------------------------------
            عزيزي مدير مدرسة ${schoolName}،
            كود التفعيل هو: >> ${code} <<
            =================================================
            `);
            resolve(true);
        }, 1500);
    });
};
