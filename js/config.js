/**
 * ==========================================================================
 * الجدار الآمن للأنظمة الإلكترونية - ملف الإعدادات والبيانات المركزية
 * Central Website Configuration & Contact Data
 * (Synced automatically from Admin Dashboard & Database)
 * ==========================================================================
 */

const SITE_CONFIG = {
  companyName: "الجدار الآمن للأنظمة الإلكترونية",
  companyShortName: "الجدار الآمن",
  tagline: "حلول متكاملة للأمن والسلامة والأنظمة الإلكترونية",

  phoneDisplay: "+962 7 9000 0000",
  phoneFormatted: "+962 7 9000 0000",
  phoneRaw: "+962790000000",
  
  whatsappNumber: "962790000000",
  whatsappDisplay: "+962 7 9000 0000",

  address: "المملكة الأردنية الهاشمية - عمّان",
  addressDetail: "المملكة الأردنية الهاشمية - عمّان",
  city: "عمّان",

  workingHours: "السبت - الخميس: 8:30 ص - 6:30 م",
  workingHoursShort: "8:30 ص - 6:30 م",
  email: "info@aljidar-security.com",

  logo: "/uploads/img-1789765939704-59e1bad4f5f45f50.png",
  socialLinks: {"facebook":"https://facebook.com/","instagram":"https://instagram.com/","tiktok":"https://tiktok.com/","twitter":"https://twitter.com/","linkedin":"https://linkedin.com/"},
  googleMapsUrl: "https://maps.google.com",

  portfolioProjects: [
  {
    "id": "proj-1",
    "title": "تركيب نظام كاميرات مراقبة وغرفة تحكم",
    "category": "cctv",
    "categoryName": "كاميرات المراقبة",
    "description": "تغطية بصرية شاملة للمبنى مع شاشات مراقبة وتسجيل رقمي بدقة 4K.",
    "image": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80"
  },
  {
    "id": "proj-2",
    "title": "شبكة إنذار ومكافحة حريق معتمدة",
    "category": "fire",
    "categoryName": "أنظمة إنذار الحريق",
    "description": "تركيب كواشف متطورة ولوحات تحكم وصناديق إطفاء مطابقة لاشتراطات الدفاع المدني.",
    "image": "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80"
  },
  {
    "id": "proj-3",
    "title": "تنظيم كابينة سيرفرات وشبكة بيانات داخلية",
    "category": "network",
    "categoryName": "أنظمة الشبكات",
    "description": "ترتيب احترافي لكابلات الفايبر وCat6 وتنظيم الباتش بانل والمفاتيح الشبكية المدارة.",
    "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80"
  },
  {
    "id": "proj-4",
    "title": "كاميرات خارجية ذكية ومقاومة للعوامل الجوية",
    "category": "cctv",
    "categoryName": "كاميرات المراقبة",
    "description": "تأمين الأسوار والمحيط الخارجي برؤية ليلية ليزرية وتتبع ذكي للحركة.",
    "image": "https://images.unsplash.com/photo-1508873535684-277a3cbcc4e8?auto=format&fit=crop&w=800&q=80"
  },
  {
    "id": "proj-5",
    "title": "نظام إنذار وحماية ضد التسلل والاقتحام",
    "category": "alarm",
    "categoryName": "أنظمة الإنذار والحماية",
    "description": "حساسات ليزرية ومغناطيسية مرتبطة بغرفة العمليات وتطبيق الجوال مع سرينات رادعة.",
    "image": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80"
  },
  {
    "id": "proj-6",
    "title": "أنظمة التحكم بالدخول وبوابات أمنية ذكية",
    "category": "safety",
    "categoryName": "أنظمة السلامة العامة",
    "description": "أجهزة قراءة بصمة الوجه والكروت المشفرة لتنظيم دخول الموظفين والزوار وتوثيق السجلات.",
    "image": "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80"
  }
]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SITE_CONFIG;
}
