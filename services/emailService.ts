
// This service simulates sending real emails. 
// In a production environment, you would integrate with EmailJS, SendGrid, or your backend API here.

export const sendActivationEmail = async (email: string, schoolName: string, code: string, type: 'registration' | 'renewal'): Promise<boolean> => {
    return new Promise((resolve) => {
        console.log(`[Email Service] Connecting to SMTP server...`);
        
        setTimeout(() => {
            // Log the email content to console for debugging/testing since we don't have a real backend
            console.log(`
            =================================================
            TO: ${email}
            SUBJECT: ${type === 'registration' ? 'تفعيل حساب المدرسة - نظام الخطط' : 'تجديد الاشتراك - نظام الخطط'}
            -------------------------------------------------
            عزيزي مدير مدرسة ${schoolName}،
            
            ${type === 'registration' ? 'شكراً لتسجيلكم في نظام الخطط الأسبوعية.' : 'تم استلام طلب تجديد الاشتراك.'}
            
            كود التفعيل الخاص بك هو:
            >> ${code} <<
            
            يرجى استخدام هذا الكود لتفعيل الحساب.
            
            مع تحيات،
            إدارة النظام
            =================================================
            `);
            
            // In a real scenario, this would simulate a successful API call
            resolve(true);
        }, 1500);
    });
};
