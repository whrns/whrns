// i18n.js - Optimized Google Translate & Common UI Logic (Vanilla JS)
(function (ns) {
    ns.PAGE_LANG = 'ko';
    ns.SUPPORT_LANGS = ['ko', 'en', 'ja', 'zh-CN'];

    // Web Storage Management
    const saveLang = (l) => {
        try {
            localStorage.setItem('site_lang', l);
            localStorage.setItem('selected_lang', l);
        } catch (e) { console.warn("localStorage not supported", e); }
    };

    const loadLang = () => {
        try { return localStorage.getItem('site_lang'); }
        catch (e) { return null; }
    };

    // Robust Cookie Management for Google Translate
    ns.setTransCookie = (lang) => {
        const cookieVal = encodeURIComponent(`/ko/${lang}`);
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1); // 1 year expiration
        const expires = `; expires=${date.toUTCString()}`;
        const host = location.hostname.replace('www.', '');
        const domainStr = host ? `; domain=${host}` : '';

        document.cookie = `googtrans=${cookieVal}${expires}; path=/${domainStr}; SameSite=Lax`;
    };

    ns.clearTransCookie = () => {
        const exp = "; expires=Thu, 01 Jan 1970 00:00:00 UTC";
        const host = location.hostname.replace('www.', '');
        const domainStr = host ? `; domain=${host}` : '';

        document.cookie = `googtrans=${exp}; path=/${domainStr}`;
    };

    ns.changeLang = (lang) => {
        saveLang(lang);
        if (lang === 'ko') {
            ns.clearTransCookie();
            const urlWithoutHash = location.href.split('#')[0];
            location.replace(urlWithoutHash);
        } else {
            ns.setTransCookie(lang);
            const newUrl = `${location.href.split('#')[0]}#googtrans(ko|${lang})`;
            location.replace(newUrl);
            location.reload();
        }
    };

    ns.updateUI = () => {
        const saved = loadLang() || 'ko';
        const buttons = document.querySelectorAll('[id^=btn_lang_]');

        buttons.forEach(btn => {
            btn.classList.remove('ring-2', 'ring-blue-500', 'opacity-100');
            btn.classList.add('opacity-60');
        });

        const targetMap = { 'en': 'en', 'ja': 'ja', 'zh-CN': 'zh', 'ko': 'ko' };
        const target = targetMap[saved] || 'ko';

        const activeBtn = document.getElementById(`btn_lang_${target}`);
        if (activeBtn) {
            activeBtn.classList.remove('opacity-60');
            activeBtn.classList.add('ring-2', 'ring-blue-500', 'opacity-100');
        }
    };

    // Initialization logic to keep translate state synced with localStorage
    ns.initTranslateState = () => {
        try {
            const saved = loadLang();
            if (saved && saved !== ns.PAGE_LANG) {
                const want = `/ko/${saved}`;
                const cookieStr = document.cookie.split('; ').find(row => row.startsWith('googtrans='));
                const currentCookie = cookieStr ? decodeURIComponent(cookieStr.split('=')[1]) : '';

                if (currentCookie !== want) {
                    ns.setTransCookie(saved);
                }
            } else if (!saved || saved === 'ko') {
                ns.clearTransCookie();
            }
        } catch (e) { console.error("Translate init error:", e); }
    };

    // Google Translate Init Callback
    window.googleTranslateElementInit = function () {
        if (typeof google === 'undefined' || !google.translate) return;
        new google.translate.TranslateElement({
            pageLanguage: ns.PAGE_LANG,
            includedLanguages: ns.SUPPORT_LANGS.join(','),
            autoDisplay: false,
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE
        }, 'google_translate_element');
    };

    // Expose functionality globally
    window.changeLang = ns.changeLang;

    // DOM Ready execution
    document.addEventListener('DOMContentLoaded', () => {
        ns.initTranslateState();
        ns.updateUI();

        // UI Interactions
        const elements = {
            menuBtn: document.querySelector('.gnb_menu_btn'),
            closeBtn: document.querySelector('.gnb_close_btn'),
            bg: document.getElementById('gnb_all_bg'),
            nav: document.getElementById('gnb_all'),
            topBtn: document.getElementById('top_btn'),
            header: document.getElementById('hd')
        };

        const toggleMenu = (isOpen) => {
            if (!elements.bg || !elements.nav) return;

            elements.bg.classList.toggle('invisible', !isOpen);
            elements.bg.classList.toggle('opacity-0', !isOpen);
            elements.bg.classList.toggle('visible', isOpen);
            elements.bg.classList.toggle('opacity-100', isOpen);

            elements.nav.classList.toggle('-right-full', !isOpen);
            elements.nav.classList.toggle('right-0', isOpen);

            document.body.classList.toggle('overflow-hidden', isOpen);
        };

        if (elements.menuBtn) elements.menuBtn.addEventListener('click', () => toggleMenu(true));
        if (elements.closeBtn) elements.closeBtn.addEventListener('click', () => toggleMenu(false));
        if (elements.bg) elements.bg.addEventListener('click', () => toggleMenu(false));

        // Scroll optimizations (requestAnimationFrame for performance)
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;

                    if (elements.topBtn) {
                        const showBtn = scrollY > 300;
                        elements.topBtn.style.display = showBtn ? 'flex' : 'none';
                        elements.topBtn.style.opacity = showBtn ? '1' : '0';
                    }

                    if (elements.header) {
                        elements.header.classList.toggle('glass-header', scrollY > 50);
                        elements.header.classList.toggle('shadow-sm', scrollY > 50);
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });

        if (elements.topBtn) {
            elements.topBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // MutationObserver to prevent automatic un-translation bugs (Google Translate quirk)
        let reverting = false;
        const htmlEl = document.documentElement;

        const checkTranslationState = () => {
            const isTranslated = htmlEl.classList.contains('translated-ltr') || htmlEl.classList.contains('translated-rtl');
            return isTranslated;
        };

        let lastState = checkTranslationState();

        const observer = new MutationObserver(() => {
            const nowState = checkTranslationState();
            if (lastState && !nowState && !reverting) {
                reverting = true;
                saveLang(ns.PAGE_LANG);
                ns.updateUI();
                setTimeout(() => { reverting = false; }, 300);
            }
            lastState = nowState;
        });

        observer.observe(htmlEl, { attributes: true, attributeFilter: ['class'] });

        // Lazy load Google Translate strictly after DOM loads
        setTimeout(() => {
            const gtScript = document.createElement('script');
            gtScript.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
            gtScript.async = true;
            document.body.appendChild(gtScript);
        }, 100);
    });

})(window.__gt = window.__gt || {});
