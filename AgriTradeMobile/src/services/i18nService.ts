import { SupportedLanguage } from '@/types';

interface TranslationData {
  [key: string]: {
    [lang in SupportedLanguage]: string;
  };
}

class InternationalizationService {
  private currentLanguage: SupportedLanguage = 'en';
  private translations: TranslationData = {};
  private fallbackLanguage: SupportedLanguage = 'en';

  constructor() {
    this.loadTranslations();
  }

  /**
   * Load all translations
   */
  private loadTranslations(): void {
    this.translations = {
      // Common
      'common.loading': {
        en: 'Loading...',
        fr: 'Chargement...',
        sw: 'Inapakia...',
        ar: 'جاري التحميل...'
      },
      'common.error': {
        en: 'Error',
        fr: 'Erreur',
        sw: 'Hitilafu',
        ar: 'خطأ'
      },
      'common.success': {
        en: 'Success',
        fr: 'Succès',
        sw: 'Mafanikio',
        ar: 'نجح'
      },
      'common.cancel': {
        en: 'Cancel',
        fr: 'Annuler',
        sw: 'Ghairi',
        ar: 'إلغاء'
      },
      'common.confirm': {
        en: 'Confirm',
        fr: 'Confirmer',
        sw: 'Thibitisha',
        ar: 'تأكيد'
      },
      'common.save': {
        en: 'Save',
        fr: 'Enregistrer',
        sw: 'Hifadhi',
        ar: 'حفظ'
      },
      'common.delete': {
        en: 'Delete',
        fr: 'Supprimer',
        sw: 'Futa',
        ar: 'حذف'
      },
      'common.edit': {
        en: 'Edit',
        fr: 'Modifier',
        sw: 'Hariri',
        ar: 'تعديل'
      },
      'common.search': {
        en: 'Search',
        fr: 'Rechercher',
        sw: 'Tafuta',
        ar: 'بحث'
      },
      'common.filter': {
        en: 'Filter',
        fr: 'Filtrer',
        sw: 'Chuja',
        ar: 'تصفية'
      },
      'common.sort': {
        en: 'Sort',
        fr: 'Trier',
        sw: 'Panga',
        ar: 'ترتيب'
      },
      'common.refresh': {
        en: 'Refresh',
        fr: 'Actualiser',
        sw: 'Onyesha upya',
        ar: 'تحديث'
      },

      // Authentication
      'auth.welcome': {
        en: 'Welcome to AgriTrade AI',
        fr: 'Bienvenue sur AgriTrade AI',
        sw: 'Karibu kwenye AgriTrade AI',
        ar: 'مرحباً بك في AgriTrade AI'
      },
      'auth.login': {
        en: 'Login',
        fr: 'Connexion',
        sw: 'Ingia',
        ar: 'تسجيل الدخول'
      },
      'auth.register': {
        en: 'Register',
        fr: 'S\'inscrire',
        sw: 'Jisajili',
        ar: 'تسجيل'
      },
      'auth.phone': {
        en: 'Phone Number',
        fr: 'Numéro de téléphone',
        sw: 'Nambari ya simu',
        ar: 'رقم الهاتف'
      },
      'auth.verificationCode': {
        en: 'Verification Code',
        fr: 'Code de vérification',
        sw: 'Nambari ya uthibitisho',
        ar: 'رمز التحقق'
      },
      'auth.sendCode': {
        en: 'Send Code',
        fr: 'Envoyer le code',
        sw: 'Tuma nambari',
        ar: 'إرسال الرمز'
      },
      'auth.verify': {
        en: 'Verify',
        fr: 'Vérifier',
        sw: 'Thibitisha',
        ar: 'تحقق'
      },
      'auth.name': {
        en: 'Full Name',
        fr: 'Nom complet',
        sw: 'Jina kamili',
        ar: 'الاسم الكامل'
      },
      'auth.userType': {
        en: 'I am a',
        fr: 'Je suis un',
        sw: 'Mimi ni',
        ar: 'أنا'
      },
      'auth.farmer': {
        en: 'Farmer',
        fr: 'Agriculteur',
        sw: 'Mkulima',
        ar: 'مزارع'
      },
      'auth.buyer': {
        en: 'Buyer',
        fr: 'Acheteur',
        sw: 'Mnunuzi',
        ar: 'مشتري'
      },

      // Dashboard
      'dashboard.title': {
        en: 'Dashboard',
        fr: 'Tableau de bord',
        sw: 'Dashibodi',
        ar: 'لوحة القيادة'
      },
      'dashboard.goodMorning': {
        en: 'Good morning',
        fr: 'Bonjour',
        sw: 'Habari za asubuhi',
        ar: 'صباح الخير'
      },
      'dashboard.goodAfternoon': {
        en: 'Good afternoon',
        fr: 'Bon après-midi',
        sw: 'Habari za mchana',
        ar: 'مساء الخير'
      },
      'dashboard.goodEvening': {
        en: 'Bonsoir',
        fr: 'Good evening',
        sw: 'Habari za jioni',
        ar: 'مساء الخير'
      },
      'dashboard.totalProducts': {
        en: 'Total Products',
        fr: 'Total des produits',
        sw: 'Jumla ya bidhaa',
        ar: 'إجمالي المنتجات'
      },
      'dashboard.activeOrders': {
        en: 'Active Orders',
        fr: 'Commandes actives',
        sw: 'Maagizo yanayoendelea',
        ar: 'الطلبات النشطة'
      },
      'dashboard.totalRevenue': {
        en: 'Total Revenue',
        fr: 'Chiffre d\'affaires total',
        sw: 'Mapato ya jumla',
        ar: 'إجمالي الإيرادات'
      },
      'dashboard.qualityScore': {
        en: 'Quality Score',
        fr: 'Score de qualité',
        sw: 'Alama ya ubora',
        ar: 'نقاط الجودة'
      },

      // Products
      'products.title': {
        en: 'Products',
        fr: 'Produits',
        sw: 'Bidhaa',
        ar: 'المنتجات'
      },
      'products.myProducts': {
        en: 'My Products',
        fr: 'Mes produits',
        sw: 'Bidhaa zangu',
        ar: 'منتجاتي'
      },
      'products.addProduct': {
        en: 'Add Product',
        fr: 'Ajouter un produit',
        sw: 'Ongeza bidhaa',
        ar: 'إضافة منتج'
      },
      'products.productName': {
        en: 'Product Name',
        fr: 'Nom du produit',
        sw: 'Jina la bidhaa',
        ar: 'اسم المنتج'
      },
      'products.category': {
        en: 'Category',
        fr: 'Catégorie',
        sw: 'Aina',
        ar: 'الفئة'
      },
      'products.price': {
        en: 'Price',
        fr: 'Prix',
        sw: 'Bei',
        ar: 'السعر'
      },
      'products.quantity': {
        en: 'Quantity',
        fr: 'Quantité',
        sw: 'Kiasi',
        ar: 'الكمية'
      },
      'products.unit': {
        en: 'Unit',
        fr: 'Unité',
        sw: 'Kipimo',
        ar: 'الوحدة'
      },
      'products.description': {
        en: 'Description',
        fr: 'Description',
        sw: 'Maelezo',
        ar: 'الوصف'
      },
      'products.images': {
        en: 'Images',
        fr: 'Images',
        sw: 'Picha',
        ar: 'الصور'
      },

      // Categories
      'category.vegetables': {
        en: 'Vegetables',
        fr: 'Légumes',
        sw: 'Mboga',
        ar: 'خضروات'
      },
      'category.fruits': {
        en: 'Fruits',
        fr: 'Fruits',
        sw: 'Matunda',
        ar: 'فواكه'
      },
      'category.grains': {
        en: 'Grains',
        fr: 'Céréales',
        sw: 'Nafaka',
        ar: 'حبوب'
      },
      'category.legumes': {
        en: 'Legumes',
        fr: 'Légumineuses',
        sw: 'Kunde',
        ar: 'بقوليات'
      },

      // Quality Analysis
      'quality.title': {
        en: 'Quality Analysis',
        fr: 'Analyse de qualité',
        sw: 'Uchambuzi wa ubora',
        ar: 'تحليل الجودة'
      },
      'quality.takePhoto': {
        en: 'Take Photo',
        fr: 'Prendre une photo',
        sw: 'Piga picha',
        ar: 'التقاط صورة'
      },
      'quality.analyzing': {
        en: 'Analyzing...',
        fr: 'Analyse en cours...',
        sw: 'Inachambuza...',
        ar: 'جاري التحليل...'
      },
      'quality.results': {
        en: 'Analysis Results',
        fr: 'Résultats de l\'analyse',
        sw: 'Matokeo ya uchambuzi',
        ar: 'نتائج التحليل'
      },
      'quality.score': {
        en: 'Quality Score',
        fr: 'Score de qualité',
        sw: 'Alama ya ubora',
        ar: 'نقاط الجودة'
      },
      'quality.excellent': {
        en: 'Excellent',
        fr: 'Excellent',
        sw: 'Bora sana',
        ar: 'ممتاز'
      },
      'quality.good': {
        en: 'Good',
        fr: 'Bon',
        sw: 'Nzuri',
        ar: 'جيد'
      },
      'quality.fair': {
        en: 'Fair',
        fr: 'Passable',
        sw: 'Wastani',
        ar: 'مقبول'
      },
      'quality.poor': {
        en: 'Poor',
        fr: 'Mauvais',
        sw: 'Mbaya',
        ar: 'ضعيف'
      },

      // Voice Assistant
      'voice.listening': {
        en: 'Listening...',
        fr: 'Écoute...',
        sw: 'Nasikiliza...',
        ar: 'أستمع...'
      },
      'voice.tapToSpeak': {
        en: 'Tap to speak',
        fr: 'Appuyez pour parler',
        sw: 'Gonga ili uongee',
        ar: 'اضغط للتحدث'
      },
      'voice.processing': {
        en: 'Processing...',
        fr: 'Traitement...',
        sw: 'Inachakata...',
        ar: 'معالجة...'
      },
      'voice.commandExecuted': {
        en: 'Command executed',
        fr: 'Commande exécutée',
        sw: 'Amri imetekelezwa',
        ar: 'تم تنفيذ الأمر'
      },
      'voice.commandNotRecognized': {
        en: 'Command not recognized',
        fr: 'Commande non reconnue',
        sw: 'Amri haijatambuliwa',
        ar: 'الأمر غير معروف'
      },
      'voice.errorProcessing': {
        en: 'Error processing command',
        fr: 'Erreur de traitement',
        sw: 'Hitilafu katika uchakataji',
        ar: 'خطأ في المعالجة'
      },

      // Chat
      'chat.typeMessage': {
        en: 'Type a message...',
        fr: 'Tapez un message...',
        sw: 'Andika ujumbe...',
        ar: 'اكتب رسالة...'
      },
      'chat.online': {
        en: 'Online',
        fr: 'En ligne',
        sw: 'Mtandaoni',
        ar: 'متصل'
      },
      'chat.offline': {
        en: 'Offline',
        fr: 'Hors ligne',
        sw: 'Nje ya mtandao',
        ar: 'غير متصل'
      },
      'chat.typing': {
        en: 'is typing...',
        fr: 'tape...',
        sw: 'anaandika...',
        ar: 'يكتب...'
      },

      // Notifications
      'notifications.title': {
        en: 'Notifications',
        fr: 'Notifications',
        sw: 'Arifa',
        ar: 'الإشعارات'
      },
      'notifications.markAllRead': {
        en: 'Mark all as read',
        fr: 'Marquer tout comme lu',
        sw: 'Alama zote kama zimesomwa',
        ar: 'تحديد الكل كمقروء'
      },
      'notifications.noNotifications': {
        en: 'No notifications',
        fr: 'Aucune notification',
        sw: 'Hakuna arifa',
        ar: 'لا توجد إشعارات'
      },

      // Settings
      'settings.title': {
        en: 'Settings',
        fr: 'Paramètres',
        sw: 'Mipangilio',
        ar: 'الإعدادات'
      },
      'settings.language': {
        en: 'Language',
        fr: 'Langue',
        sw: 'Lugha',
        ar: 'اللغة'
      },
      'settings.profile': {
        en: 'Profile',
        fr: 'Profil',
        sw: 'Wasifu',
        ar: 'الملف الشخصي'
      },
      'settings.logout': {
        en: 'Logout',
        fr: 'Déconnexion',
        sw: 'Ondoka',
        ar: 'تسجيل الخروج'
      },

      // Currency
      'currency.symbol': {
        en: '$',
        fr: '€',
        sw: 'KSh',
        ar: 'ر.س'
      },

      // Units
      'unit.kg': {
        en: 'kg',
        fr: 'kg',
        sw: 'kg',
        ar: 'كج'
      },
      'unit.piece': {
        en: 'piece',
        fr: 'pièce',
        sw: 'kipande',
        ar: 'قطعة'
      },
      'unit.bag': {
        en: 'bag',
        fr: 'sac',
        sw: 'mfuko',
        ar: 'كيس'
      },

      // Errors
      'error.networkError': {
        en: 'Network error. Please check your connection.',
        fr: 'Erreur réseau. Veuillez vérifier votre connexion.',
        sw: 'Hitilafu ya mtandao. Tafadhali angalia muunganisho wako.',
        ar: 'خطأ في الشبكة. يرجى التحقق من اتصالك.'
      },
      'error.serverError': {
        en: 'Server error. Please try again later.',
        fr: 'Erreur serveur. Veuillez réessayer plus tard.',
        sw: 'Hitilafu ya seva. Tafadhali jaribu tena baadaye.',
        ar: 'خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.'
      },
      'error.validationError': {
        en: 'Please check your input and try again.',
        fr: 'Veuillez vérifier votre saisie et réessayer.',
        sw: 'Tafadhali angalia maingizo yako na ujaribu tena.',
        ar: 'يرجى التحقق من المدخلات والمحاولة مرة أخرى.'
      }
    };
  }

  /**
   * Set current language
   */
  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Get translation for a key
   */
  translate(key: string, params?: Record<string, string>): string {
    const translation = this.translations[key];
    
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    let text = translation[this.currentLanguage] || translation[this.fallbackLanguage] || key;

    // Replace parameters if provided
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(`{{${param}}}`, params[param]);
      });
    }

    return text;
  }

  /**
   * Get translation with shorthand method
   */
  t = (key: string, params?: Record<string, string>): string => {
    return this.translate(key, params);
  };

  /**
   * Get all available languages
   */
  getAvailableLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' }
    ];
  }

  /**
   * Get language direction (LTR or RTL)
   */
  getLanguageDirection(language?: SupportedLanguage): 'ltr' | 'rtl' {
    const lang = language || this.currentLanguage;
    return lang === 'ar' ? 'rtl' : 'ltr';
  }

  /**
   * Format number according to current language
   */
  formatNumber(number: number): string {
    try {
      const locales = {
        en: 'en-US',
        fr: 'fr-FR',
        sw: 'sw-KE',
        ar: 'ar-SA'
      };
      
      return number.toLocaleString(locales[this.currentLanguage]);
    } catch (error) {
      return number.toString();
    }
  }

  /**
   * Format currency according to current language
   */
  formatCurrency(amount: number, currency?: string): string {
    const currencyCode = currency || this.getCurrencyForLanguage();
    const symbol = this.translate('currency.symbol');
    
    if (this.currentLanguage === 'ar') {
      return `${this.formatNumber(amount)} ${symbol}`;
    }
    
    return `${symbol}${this.formatNumber(amount)}`;
  }

  /**
   * Get currency code for current language
   */
  private getCurrencyForLanguage(): string {
    const currencies = {
      en: 'USD',
      fr: 'EUR',
      sw: 'KES',
      ar: 'SAR'
    };
    return currencies[this.currentLanguage];
  }

  /**
   * Format date according to current language
   */
  formatDate(date: Date): string {
    try {
      const locales = {
        en: 'en-US',
        fr: 'fr-FR',
        sw: 'sw-KE',
        ar: 'ar-SA'
      };
      
      return date.toLocaleDateString(locales[this.currentLanguage]);
    } catch (error) {
      return date.toLocaleDateString();
    }
  }

  /**
   * Get RTL styles if current language is RTL
   */
  getRTLStyle(styles: any): any {
    if (this.getLanguageDirection() === 'rtl') {
      return {
        ...styles,
        direction: 'rtl',
        textAlign: 'right',
        writingDirection: 'rtl'
      };
    }
    return styles;
  }

  /**
   * Check if current language is RTL
   */
  isRTL(): boolean {
    return this.getLanguageDirection() === 'rtl';
  }
}

export const i18nService = new InternationalizationService();
export default i18nService;