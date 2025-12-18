
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_id_placeholder'; 
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_id_placeholder';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_placeholder';

export const sendActivationEmail = async (email: string, schoolName: string, code: string, type: 'registration' | 'renewal'): Promise<boolean> => {
    
    const isConfigured = EMAILJS_SERVICE_ID !== 'service_id_placeholder';

    if (!isConfigured) {
        console.warn('EmailJS keys not found in .env. Falling back to simulation mode.');
        return simulateEmail(email, schoolName, code, type);
    }

    try {
        const messageBody = type === 'registration' 
            ? `مرحباً مدير مدرسة ${schoolName}، شكراً لتسجيلكم في نظام Madrasti Planner. كود الدخول الخاص بمدرستكم هو: ${code}. يرجى الاحتفاظ بهذا الكود للدخول إلى لوحة التحكم مستقبلاً.`
            : `مرحباً مدير مدرسة ${schoolName}، تم استلام طلب تجديد الاشتراك. كود التفعيل الخاص بك هو: ${code}`;

        const templateParams = {
            to_email: email,
            to_name: schoolName,
            subject: type === 'registration' ? 'تم إنشاء حساب مدرستك بنجاح - كود الدخول' : 'تجديد الاشتراك - كود التفعيل',
            message: messageBody,
            code: code,
        };

        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
        return true;

    } catch (error) {
        console.error('[Email Service] Failed to send email:', error);
        return false;
    }
};

const simulateEmail = async (email: string, schoolName: string, code: string, type: 'registration' | 'renewal'): Promise<boolean> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`
            =================================================
            [بريد إلكتروني محاكي - مخصص للتطوير]
            إلى: ${email}
            الموضوع: ${type === 'registration' ? 'تم إنشاء حساب مدرستك' : 'تجديد الاشتراك'}
            -------------------------------------------------
            مرحباً مدير مدرسة ${schoolName}،
            
            ${type === 'registration' 
                ? `شكراً لتسجيلك! كود دخول مدرستك هو: [ ${code} ]` 
                : `كود تفعيل اشتراكك هو: [ ${code} ]`}
            
            فريق Madrasti Planner
            =================================================
            `);
            resolve(true);
        }, 1000);
    });
};
