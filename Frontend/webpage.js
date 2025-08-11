// This file contains the core logic and data for the website.

// --- EventTracker Module (Content from event-tracker.js) ---
const EventTracker = (() => {

    // --- CONFIGURATION ---
    const cloudFunctionUrls = {
        first_visit:'http://127.0.0.1:8081',
        session_start:'http://127.0.0.1:8089',
        view_item: 'http://127.0.0.1:8083',
        click: 'http://127.0.0.1:8080',
        scroll: 'http://127.0.0.1:8088',
        view_page: 'http://127.0.0.1:8082',
        zooming: 'http://127.0.0.1:8085',
        user_reviews:'http://127.0.0.1:8086',
        view_user_reviews:'http://127.0.0.1:8087',
        view_product_details: 'http://127.0.0.1:8090',
        session_time: 'http://127.0.0.1:8091',
        store_visit: 'http://127.0.0.1:8092',
    };

    const SELLER_ID_MAP = {
        'Trendy Threads': 'trendy-threads-seller',
        'Tech Emporium': 'tech-emporium-seller',
        'The Book Nook': 'book-nook-seller',
        'Active Zone': 'active-zone-seller',
    };
    
    let currentUserId = null;
    let pageStartTime = Date.now();

    const getOrCreateUserId = () => {
        const loggedInUserId = sessionStorage.getItem('user_id');
        if (loggedInUserId) {
            currentUserId = loggedInUserId;
            return loggedInUserId;
        }

        let anonymousId = sessionStorage.getItem('anon_user_id');
        if (anonymousId) {
            currentUserId = anonymousId;
            return anonymousId;
        }
        
        anonymousId = 'anon-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('anon_user_id', anonymousId);
        currentUserId = anonymousId;
        return anonymousId;
    };

    const getOrCreateSessionId = () => {
        let sessionId = sessionStorage.getItem(`session_id_${currentUserId}`);
        if (!sessionId) {
            sessionId = 'session-' + currentUserId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
            sessionStorage.setItem(`session_id_${currentUserId}`, sessionId);
        }
        return sessionId;
    };

    const getDeviceData = () => {
        const userAgent = navigator.userAgent;
        let category = 'desktop';
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
            category = 'tablet';
        } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) {
            category = 'mobile';
        }
        return {
            category: category,
            os: navigator.platform,
            browser: getBrowserName(userAgent)
        };
    };

    const getBrowserName = (userAgent) => {
        if (userAgent.indexOf("Firefox") > -1) return "Firefox";
        if (userAgent.indexOf("Edg") > -1) return "Edge";
        if (userAgent.indexOf("Chrome") > -1) return "Chrome";
        if (userAgent.indexOf("Safari") > -1) return "Safari";
        if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) return "Opera";
        if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) return "IE";
        return "Unknown";
    };

    const getGeoData = () => {
        return {
            country: 'IN',
            region: 'KA',
            city: 'Bengaluru'
        };
    };
    
    const getTrafficSource = () => {
        const referrer = document.referrer;
        let source = 'direct';
        let medium = '(none)';
        if (referrer) {
            try {
                const url = new URL(referrer);
                source = url.hostname;
                medium = 'referral';
            } catch (e) {
                source = referrer;
                medium = 'referral';
            }
        }
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('utm_source')) source = urlParams.get('utm_source');
        if (urlParams.has('utm_medium')) medium = urlParams.get('utm_medium');
        return { source, medium };
    };

    const track = (eventName, specificPayload = {}) => {
        const url = cloudFunctionUrls[eventName];
        if (!url || url.includes('YOUR_PROJECT_ID')) {
            console.warn(`[EventTracker] Not tracking event '${eventName}'. Please configure your Cloud Function URL in the cloudFunctionUrls object.`);
            console.log(`[EventTracker] Payload that would have been sent:`, specificPayload);
            return;
        }
        
        const commonPayload = {
            event_name: eventName,
            event_timestamp: new Date().toISOString(),
            user_id: getOrCreateUserId(),
            session_id: getOrCreateSessionId(),
            page_location: window.location.href,
            page_title: document.title,
            device: getDeviceData(),
            geo: getGeoData(),
            traffic_source: getTrafficSource(),
            seller_id: specificPayload.seller_id || null,
            store_name: specificPayload.store_name || null,
        };

        const pageDurationSeconds = Math.round((Date.now() - pageStartTime) / 1000);

        const finalPayload = { ...commonPayload };

        if (eventName === 'view_item' || eventName === 'view_product_details') {
            if (specificPayload.item) {
                finalPayload.item = {
                    item_id: specificPayload.item.item_id,
                    item_name: specificPayload.item.item_name,
                    item_category: specificPayload.item.item_category,
                    price: specificPayload.item.price,
                    item_brand: specificPayload.item.item_brand,
                    item_variant: specificPayload.item.item_variant
                };
                finalPayload.page_duration_seconds = pageDurationSeconds;
            }
        }
        
        if (eventName === 'zooming') {
            if (specificPayload.item && specificPayload.item.image_details) {
                 finalPayload.item = {
                    item_id: specificPayload.item.item_id,
                    item_name: specificPayload.item.item_name,
                };
                finalPayload.image_details = specificPayload.image_details;
            }
            finalPayload.zoom_level = specificPayload.zoom_level;
            finalPayload.zoom_duration_seconds = specificPayload.zoom_duration_seconds || null;
        }
        
        if (eventName === 'user_reviews') {
            if (specificPayload.item && specificPayload.review) {
                finalPayload.item = {
                    item_id: specificPayload.item.item_id,
                    item_name: specificPayload.item.item_name,
                    item_category: specificPayload.item.item_category,
                    price: specificPayload.item.price,
                };
                finalPayload.review = {
                    reviewer_name: specificPayload.review.reviewer_name || finalPayload.user_id,
                    review_images_count: specificPayload.review.review_images_count || 0,
                };
                finalPayload.review_rating = specificPayload.review.rating;
                finalPayload.review_text = specificPayload.review.review_text;
                finalPayload.page_duration_seconds = pageDurationSeconds;
            }
        }
        
        if (eventName === 'view_user_reviews') {
            if (specificPayload.item) {
                finalPayload.item = {
                    item_id: specificPayload.item.item_id,
                    item_name: specificPayload.item.item_name,
                    item_category: specificPayload.item.item_category,
                    price: specificPayload.item.price,
                };
            }
            finalPayload.viewed_reviews_count = specificPayload.viewed_reviews_count;
            finalPayload.page_duration_seconds = pageDurationSeconds;
            finalPayload.reviews_scroll_depth_percentage = specificPayload.reviews_scroll_depth_percentage || null;
            finalPayload.review_sort_order = specificPayload.review_sort_order || null;
        }
        
        if (eventName === 'view_page' || eventName === 'scroll' || eventName === 'first_visit') {
            finalPayload.page_duration_seconds = pageDurationSeconds;
            finalPayload.scroll_depth_percentage = specificPayload.scroll_depth_percentage || null;
            finalPayload.page_referrer = document.referrer;
        }

        if (eventName === 'session_time') {
            finalPayload.session_duration = specificPayload.session_duration;
        }

        if (eventName === 'store_visit') {
            finalPayload.store_name = specificPayload.store_name;
            finalPayload.seller_id = specificPayload.seller_id;
            finalPayload.page_duration_seconds = pageDurationSeconds;
        }
        
        const payload = JSON.stringify(finalPayload);
        console.log(`[EventTracker] Preparing to send event: ${eventName}`);
        console.log(`[EventTracker] Target URL: ${url}`);
        console.log(`[EventTracker] Payload (JSON string):`, payload);
        console.log(`[EventTracker] Payload (Parsed Object):`, finalPayload);
        fetch(url, {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'application/json' },
            keepalive: true
        })
        .then(response => {
            console.log(`[EventTracker] Fetch response status for ${eventName}:`, response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
                });
            }
            return response.text();
        })
        .then(responseText => {
            console.log(`[EventTracker] Fetch response body for ${eventName}:`, responseText);
        })
        .catch(error => {
            console.error(`[EventTracker] Error sending event ${eventName}:`, error);
        });
        console.log(`[EventTracker] Fired Event: ${eventName}`);
    };

    const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
    let inactivityTimer;
    let lastActivityTime;
    const resetInactivityTimer = () => {
        clearTimeout(inactivityTimer);
        lastActivityTime = Date.now();
        sessionStorage.setItem(`session_last_activity_${currentUserId}`, lastActivityTime);
        inactivityTimer = setTimeout(endCurrentSession, SESSION_TIMEOUT_MS);
    };
    const endCurrentSession = () => {
        if (!currentUserId || !sessionStorage.getItem(`session_id_${currentUserId}`)) {
            return;
        }
        const sessionStartTimeMs = parseInt(sessionStorage.getItem(`session_start_time_${currentUserId}`) || Date.now());
        const sessionDurationSeconds = Math.round((Date.now() - sessionStartTimeMs) / 1000);
        track('session_time', { session_duration: sessionDurationSeconds });
        sessionStorage.removeItem(`session_id_${currentUserId}`);
        sessionStorage.removeItem(`session_start_time_${currentUserId}`);
        sessionStorage.removeItem(`session_last_activity_${currentUserId}`);
    };
    const startNewSession = () => {
        const newSessionId = 'session-' + currentUserId + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        sessionStorage.setItem(`session_id_${currentUserId}`, newSessionId);
        sessionStorage.setItem(`session_start_time_${currentUserId}`, Date.now());
        track('session_start');
        resetInactivityTimer();
    };
    const init = () => {
        getOrCreateUserId();
        const lastActivity = parseInt(sessionStorage.getItem(`session_last_activity_${currentUserId}`) || 0);
        const now = Date.now();
        if (now - lastActivity > SESSION_TIMEOUT_MS) {
            startNewSession();
        } else {
            resetInactivityTimer();
        }
        const firstVisitKey = `first_visit_tracked_for_${currentUserId}`;
        if (!sessionStorage.getItem(firstVisitKey)) {
            track('first_visit');
            sessionStorage.setItem(firstVisitKey, 'true');
        }
        
        ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            window.addEventListener(event, resetInactivityTimer, { passive: true });
        });
        document.body.addEventListener('click', (e) => {
            const element = e.target.closest('button, a, input[type="submit"], [role="button"], [onclick]');
            if (!element) return;
            track('click');
        }, true);
        let scrollDepthsTracked = {};
        const trackScroll = () => {
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollableHeight <= 0) return;
            const scrollPercent = Math.round((window.scrollY / scrollableHeight) * 100);
            const depthsToTrack = [25, 50, 75, 90];
            depthsToTrack.forEach(depth => {
                if (scrollPercent >= depth && !scrollDepthsTracked[depth]) {
                    track('scroll', { scroll_depth_percentage: depth });
                    scrollDepthsTracked[depth] = true;
                }
            });
        };
        const resetScrollTracker = () => { 
            scrollDepthsTracked = {}; 
            pageStartTime = Date.now();
        };
        window.addEventListener('hashchange', resetScrollTracker);
        window.addEventListener('scroll', trackScroll, { passive: true });
        window.addEventListener('beforeunload', EventTracker._endCurrentSessionInternal);
    };

    const setUserId = (newUserId) => {
        if (typeof newUserId === 'string' && newUserId.trim() !== '') {
            const oldUserId = currentUserId;
            currentUserId = newUserId;
            sessionStorage.setItem('user_id', newUserId);
            if (oldUserId !== newUserId) {
                const firstVisitKey = `first_visit_tracked_for_${newUserId}`;
                if (!sessionStorage.getItem(firstVisitKey)) {
                    track('first_visit');
                    sessionStorage.setItem(firstVisitKey, 'true');
                }
            }
        } else {
            console.warn("[EventTracker] Invalid user ID provided to setUserId:", newUserId);
        }
    };

    const clearUserId = () => {
        currentUserId = null;
        sessionStorage.removeItem('user_id');
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key.startsWith('first_visit_tracked_for_')) {
                sessionStorage.removeItem(key);
            }
        }
    };
    
    return {
        init,
        track,
        setUserId,
        clearUserId,
        getSellerId: (storeName) => SELLER_ID_MAP[storeName] || null,
        _endCurrentSessionInternal: endCurrentSession
    };
})();

// MOCK PRODUCT DATA
const products = [
    // Trendy Threads - 10 products
    { id: 'tt001', name: 'Elegant Evening Dress', category: 'Fashion', store: 'Trendy Threads', price: 89.99, image: 'https://placehold.co/400x300/a55447/fff?text=Elegant+Dress', moreImages: ['https://placehold.co/150x100/a55447/fff?text=Dress+-+Front', 'https://placehold.co/150x100/a55447/fff?text=Dress+-+Back'], description: 'A stunning dress perfect for evening events. Made from high-quality silk blend.', brand: 'Glamourous Attire', variant: 'Blue-Large' },
    { id: 'tt002', name: 'Men\'s Slim Fit Shirt', category: 'Fashion', store: 'Trendy Threads', price: 34.99, image: 'https://placehold.co/400x300/6f594e/fff?text=Slim+Fit+Shirt', moreImages: ['https://placehold.co/150x100/6f594e/fff?text=Shirt+-+Detail', 'https://placehold.co/150x100/6f594e/fff?text=Shirt+-+Model'], description: 'A crisp, slim-fit shirt made from 100% breathable cotton. Ideal for work or casual wear.', brand: 'Gentleman\'s Choice', variant: 'White-Medium' },
    { id: 'tt003', name: 'High-Waisted Denim Jeans', category: 'Fashion', store: 'Trendy Threads', price: 49.99, image: 'https://placehold.co/400x300/3d5162/fff?text=Denim+Jeans', moreImages: ['https://placehold.co/150x100/3d5162/fff?text=Jeans+-+Texture', 'https://placehold.co/150x100/3d5162/fff?text=Jeans+-+Fit'], description: 'Classic high-waisted denim jeans with a modern fit. Durable and stylish.', brand: 'Denim Dreams', variant: 'Blue-Size28' },
    { id: 'tt004', name: 'Classic Summer Hat', category: 'Fashion', store: 'Trendy Threads', price: 18.00, image: 'https://placehold.co/400x300/e8d5b5/333?text=Summer+Hat', moreImages: ['https://placehold.co/150x100/e8d5b5/333?text=Hat+-+Side', 'https://placehold.co/150x100/e8d5b5/333?text=Hat+-+Top'], description: 'Protect yourself from the sun with this timeless and fashionable summer hat.', brand: 'SunShield', variant: 'Straw-Beige' },
    { id: 'tt005', name: 'Women\'s Floral Blouse', category: 'Fashion', store: 'Trendy Threads', price: 27.50, image: 'https://placehold.co/400x300/f08080/fff?text=Floral+Blouse', moreImages: ['https://placehold.co/150x100/f08080/fff?text=Blouse+-+Detail', 'https://placehold.co/150x100/f08080/fff?text=Blouse+-+Model'], description: 'A beautiful floral blouse perfect for spring and summer.', brand: 'BloomWear', variant: 'Multi-color-S' },
    { id: 'tt006', name: 'Sporty Sneakers', category: 'Fashion', store: 'Trendy Threads', price: 65.00, image: 'https://placehold.co/400x300/586f7c/fff?text=Sporty+Sneakers', moreImages: ['https://placehold.co/150x100/586f7c/fff?text=Sneakers+-+Side', 'https://placehold.co/150x100/586f7c/fff?text=Sneakers+-+Sole'], description: 'Comfortable and stylish sneakers for everyday wear.', brand: 'StrideFoot', variant: 'Black-Size9' },
    { id: 'tt007', name: 'Leather Crossbody Bag', category: 'Fashion', store: 'Trendy Threads', price: 120.00, image: 'https://placehold.co/400x300/9b7e77/fff?text=Crossbody+Bag', moreImages: ['https://placehold.co/150x100/9b7e77/fff?text=Bag+-+Open', 'https://placehold.co/150x100/9b7e77/fff?text=Bag+-+Strap'], description: 'A chic and practical leather bag with adjustable strap.', brand: 'Elegance Carry', variant: 'Brown' },
    { id: 'tt008', name: 'Cozy Knit Sweater', category: 'Fashion', store: 'Trendy Threads', price: 55.00, image: 'https://placehold.co/400x300/4c4c4c/fff?text=Knit+Sweater', moreImages: ['https://placehold.co/150x100/4c4c4c/fff?text=Sweater+-+Texture', 'https://placehold.co/150x100/4c4c4c/fff?text=Sweater+-+Fit'], description: 'Soft and warm knit sweater, perfect for chilly evenings.', brand: 'WarmWeave', variant: 'Grey-L' },
    { id: 'tt009', name: 'Aviator Sunglasses', category: 'Fashion', store: 'Trendy Threads', price: 25.00, image: 'https://placehold.co/400x300/f3c623/333?text=Aviator+Sunglasses', moreImages: ['https://placehold.co/150x100/f3c623/333?text=Sunglasses+-+Case', 'https://placehold.co/150x100/f3c623/333?text=Sunglasses+-+Side'], description: 'Classic aviator sunglasses with UV protection.', brand: 'VisionPro', variant: 'Gold Frame' },
    { id: 'tt010', name: 'Running Shorts', category: 'Fashion', store: 'Trendy Threads', price: 29.00, image: 'https://placehold.co/400x300/1e2a44/fff?text=Running+Shorts', moreImages: ['https://placehold.co/150x100/1e2a44/fff?text=Shorts+-+Waistband', 'https://placehold.co/150x100/1e2a44/fff?text=Shorts+-+Detail'], description: 'Lightweight and breathable shorts for your runs.', brand: 'ActiveFit', variant: 'Black-M' },

    // Tech Emporium - 10 products
    { id: 'te001', name: 'Flagship Smartphone Pro', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 999.00, image: 'https://placehold.co/400x300/2f5d62/fff?text=Smartphone', moreImages: ['https://placehold.co/150x100/2f5d62/fff?text=Phone+-+Screen', 'https://placehold.co/150x100/2f5d62/fff?text=Phone+-+Camera'], description: 'The latest flagship smartphone with a stunning display and pro-grade camera system.', brand: 'ApexTech', variant: 'Midnight Black-512GB' },
    { id: 'te002', name: 'Ultra-Thin Laptop Air', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 1350.00, image: 'https://placehold.co/400x300/94b0da/333?text=Laptop', moreImages: ['https://placehold.co/150x100/94b0da/333?text=Laptop+-+Open', 'https://placehold.co/150x100/94b0da/333?text=Laptop+-+Keyboard'], description: 'Incredibly light and powerful, this laptop is perfect for professionals on the go.', brand: 'FeatherLight', variant: 'Silver-16GB RAM' },
    { id: 'te003', name: 'Noise-Cancelling Headphones', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 149.00, image: 'https://placehold.co/400x300/525252/fff?text=Headphones', moreImages: ['https://placehold.co/150x100/525252/fff?text=Headphones+-+Side', 'https://placehold.co/150x100/525252/fff?text=Headphones+-+Padded'], description: 'Immerse yourself in sound with these top-tier noise-cancelling headphones.', brand: 'SoundScape', variant: 'Matte Black' },
    { id: 'te004', name: 'Gaming Desktop PC', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 1800.00, image: 'https://placehold.co/400x300/1f4a4d/fff?text=Gaming+PC', moreImages: ['https://placehold.co/150x100/1f4a4d/fff?text=PC+-+RGB+Case', 'https://placehold.co/150x100/1f4a4d/fff?text=PC+-+Setup'], description: 'High-performance gaming PC for an unparalleled gaming experience.', brand: 'GamerForge', variant: 'RTX 4070-16GB RAM' },
    { id: 'te005', name: 'Wireless Ergonomic Mouse', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 45.00, image: 'https://placehold.co/400x300/b8b8b8/333?text=Wireless+Mouse', moreImages: ['https://placehold.co/150x100/b8b8b8/333?text=Mouse+-+Detail', 'https://placehold.co/150x100/b8b8b8/333?text=Mouse+-+Side'], description: 'Comfortable and precise wireless mouse for extended use.', brand: 'ErgoGlide', variant: 'Graphite' },
    { id: 'te006', name: '4K UHD Monitor', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 350.00, image: 'https://placehold.co/400x300/8d8d8d/fff?text=4K+Monitor', moreImages: ['https://placehold.co/150x100/8d8d8d/fff?text=Monitor+-+Screen', 'https://placehold.co/150x100/8d8d8d/fff?text=Monitor+-+Ports'], description: 'Stunning 4K resolution monitor for crystal-clear visuals.', brand: 'VividDisplay', variant: '27-inch' },
    { id: 'te007', name: 'Portable SSD 1TB', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 110.00, image: 'https://placehold.co/400x300/007bff/fff?text=Portable+SSD', moreImages: ['https://placehold.co/150x100/007bff/fff?text=SSD+-+Compact', 'https://placehold.co/150x100/007bff/fff?text=SSD+-+USB+C'], description: 'Fast and compact external solid-state drive for all your data.', brand: 'SpeedyStore', variant: 'USB-C' },
    { id: 'te008', name: 'Smartwatch Series X', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 299.00, image: 'https://placehold.co/400x300/4c4b63/fff?text=Smartwatch', moreImages: ['https://placehold.co/150x100/4c4b63/fff?text=Smartwatch+-+Face', 'https://placehold.co/150x100/4c4b63/fff?text=Smartwatch+-+Strap'], description: 'Stay connected and track your fitness with this advanced smartwatch.', brand: 'HealthTech', variant: 'Midnight Blue' },
    { id: 'te009', name: 'Webcam Pro HD', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 75.00, image: 'https://placehold.co/400x300/30475e/fff?text=Webcam', moreImages: ['https://placehold.co/150x100/30475e/fff?text=Webcam+-+Mounted', 'https://placehold.co/150x100/30475e/fff?text=Webcam+-+USB'], description: 'High-definition webcam for clear video calls and streaming.', brand: 'StreamCam', variant: '1080p' },
    { id: 'te010', name: 'Mesh Wi-Fi System', category: 'Mobiles/Computers', store: 'Tech Emporium', price: 199.00, image: 'https://placehold.co/400x300/333333/fff?text=Mesh+WiFi', moreImages: ['https://placehold.co/150x100/333333/fff?text=WiFi+-+Back', 'https://placehold.co/150x100/333333/fff?text=WiFi+-+Lights'], description: 'Eliminate dead zones with seamless whole-home Wi-Fi coverage.', brand: 'HomeNet', variant: '3-Pack' },

    // The Book Nook - 10 products
    { id: 'bn001', name: 'The Silent Patient', category: 'Books', store: 'The Book Nook', price: 15.00, image: 'https://placehold.co/400x300/4a4e69/fff?text=The+Silent+Patient', moreImages: ['https://placehold.co/150x100/4a4e69/fff?text=Book+-+Cover', 'https://placehold.co/150x100/4a4e69/fff?text=Book+-+Back'], description: 'A shocking psychological thriller with a brilliant twist.', brand: 'Celadon Books', variant: 'Hardcover' },
    { id: 'bn002', name: 'Atomic Habits', category: 'Books', store: 'The Book Nook', price: 22.50, image: 'https://placehold.co/400x300/5f4b8b/fff?text=Atomic+Habits', moreImages: ['https://placehold.co/150x100/5f4b8b/fff?text=Book+-+Spine', 'https://placehold.co/150x100/5f4b8b/fff?text=Book+-+Author'], description: 'An easy & proven way to build good habits & break bad ones.', brand: 'Avery', variant: 'Paperback' },
    { id: 'bn003', name: 'Where the Crawdads Sing', category: 'Books', store: 'The Book Nook', price: 16.00, image: 'https://placehold.co/400x300/e0b686/fff?text=Crawdads+Sing', moreImages: ['https://placehold.co/150x100/e0b686/fff?text=Book+-+Landscape', 'https://placehold.co/150x100/e0b686/fff?text=Book+-+Pages'], description: 'A captivating mystery and coming-of-age story.', brand: 'G.P. Putnam\'s Sons', variant: 'Paperback' },
    { id: 'bn004', name: 'Dune', category: 'Books', store: 'The Book Nook', price: 14.00, image: 'https://placehold.co/400x300/2a2a2a/fff?text=Dune+Novel', moreImages: ['https://placehold.co/150x100/2a2a2a/fff?text=Book+-+Cover', 'https://placehold.co/150x100/2a2a2a/fff?text=Book+-+Back'], description: 'The seminal science fiction epic of a desert planet and its messiah.', brand: 'Ace Books', variant: 'Paperback' },
    { id: 'bn005', name: 'The Midnight Library', category: 'Books', store: 'The Book Nook', price: 17.50, image: 'https://placehold.co/400x300/7a9e9f/fff?text=Midnight+Library', moreImages: ['https://placehold.co/150x100/7a9e9f/fff?text=Book+-+Shelf', 'https://placehold.co/150x100/7a9e9f/fff?text=Book+-+Quotes'], description: 'A heartwarming and philosophical tale about life choices.', brand: 'Viking', variant: 'Hardcover' },
    { id: 'bn006', name: 'Becoming', category: 'Books', store: 'The Book Nook', price: 20.00, image: 'https://placehold.co/400x300/5e503f/fff?text=Becoming+Memoir', moreImages: ['https://placehold.co/150x100/5e503f/fff?text=Book+-+Author', 'https://placehold.co/150x100/5e503f/fff?text=Book+-+Dedication'], description: 'Michelle Obama\'s intimate, powerful, and inspiring memoir.', brand: 'Crown', variant: 'Hardcover' },
    { id: 'bn007', name: 'Educated', category: 'Books', store: 'The Book Nook', price: 18.00, image: 'https://placehold.co/400x300/d4a373/333?text=Educated+Memoir', moreImages: ['https://placehold.co/150x100/d4a373/333?text=Book+-+Spine', 'https://placehold.co/150x100/d4a373/333?text=Book+-+Pages'], description: 'A memoir of a young girl who pursued knowledge despite a tyrannical father.', brand: 'Random House', variant: 'Paperback' },
    { id: 'bn008', name: 'Sapiens: A Brief History of Humankind', category: 'Books', store: 'The Book Nook', price: 25.00, image: 'https://placehold.co/400x300/c77dff/fff?text=Sapiens+Book', moreImages: ['https://placehold.co/150x100/c77dff/fff?text=Book+-+Cover', 'https://placehold.co/150x100/c77dff/fff?text=Book+-+Charts'], description: 'A sweeping history of Homo sapiens from the Stone Age to the present.', brand: 'Harper Perennial', variant: 'Paperback' },
    { id: 'bn009', name: 'The Great Gatsby', category: 'Books', store: 'The Book Nook', price: 12.00, image: 'https://placehold.co/400x300/4c6767/fff?text=Gatsby+Novel', moreImages: ['https://placehold.co/150x100/4c6767/fff?text=Book+-+Quote', 'https://placehold.co/150x100/4c6767/fff?text=Book+-+Back'], description: 'A classic novel of the Jazz Age, love, and the American Dream.', brand: 'Scribner', variant: 'Paperback' },
    { id: 'bn010', name: 'The Alchemist', category: 'Books', store: 'The Book Nook', price: 13.00, image: 'https://placehold.co/400x300/d2a33f/fff?text=The+Alchemist', moreImages: ['https://placehold.co/150x100/d2a33f/fff?text=Book+-+Spine', 'https://placehold.co/150x100/d2a33f/fff?text=Book+-+Pages'], description: 'An allegorical novel about a shepherd boy who journeys to find treasure.', brand: 'HarperOne', variant: 'Paperback' },
    
    // Active Zone - 10 products
    { id: 'az001', name: 'Yoga Mat Premium', category: 'Sports', store: 'Active Zone', price: 25.00, image: 'https://placehold.co/400x300/52b788/fff?text=Yoga+Mat', moreImages: ['https://placehold.co/150x100/52b788/fff?text=Mat+-+Rolled', 'https://placehold.co/150x100/52b788/fff?text=Mat+-+Texture'], description: 'Durable and comfortable yoga mat for all your fitness needs.', brand: 'ZenFlow', variant: '6mm-Blue' },
    { id: 'az002', name: 'Resistance Band Set', category: 'Sports', store: 'Active Zone', price: 18.00, image: 'https://placehold.co/400x300/94d2bd/333?text=Resistance+Bands', moreImages: ['https://placehold.co/150x100/94d2bd/333?text=Bands+-+Colors', 'https://placehold.co/150x100/94d2bd/333?text=Bands+-+Set'], description: 'Versatile resistance bands for full-body workouts.', brand: 'FitFlex', variant: 'Light-Heavy' },
    { id: 'az003', name: 'Smart Jump Rope', category: 'Sports', store: 'Active Zone', price: 35.00, image: 'https://placehold.co/400x300/1b4332/fff?text=Smart+Jump+Rope', moreImages: ['https://placehold.co/150x100/1b4332/fff?text=Rope+-+Handle', 'https://placehold.co/150x100/1b4332/fff?text=Rope+-+Display'], description: 'Track your jumps and calories with this smart jump rope.', brand: 'LeapMetric', variant: 'Digital' },
    { id: 'az004', name: 'Dumbbell Set Adjustable', category: 'Sports', store: 'Active Zone', price: 120.00, image: 'https://placehold.co/400x300/7678ed/fff?text=Dumbbell+Set', moreImages: ['https://placehold.co/150x100/7678ed/fff?text=Dumbbell+-+Weight', 'https://placehold.co/150x100/7678ed/fff?text=Dumbbell+-+Handle'], description: 'Space-saving adjustable dumbbells for various weights.', brand: 'IronFit', variant: '5-50lbs' },
    { id: 'az005', name: 'Fitness Tracker Watch', category: 'Sports', store: 'Active Zone', price: 80.00, image: 'https://placehold.co/400x300/386641/fff?text=Fitness+Tracker', moreImages: ['https://placehold.co/150x100/386641/fff?text=Tracker+-+Watchface', 'https://placehold.co/150x100/386641/fff?text=Tracker+-+Band'], description: 'Monitor heart rate, steps, and sleep with this advanced tracker.', brand: 'PacePro', variant: 'Black' },
    { id: 'az006', name: 'Cycling Helmet Aerodynamic', category: 'Sports', store: 'Active Zone', price: 60.00, image: 'https://placehold.co/400x300/fca311/333?text=Cycling+Helmet', moreImages: ['https://placehold.co/150x100/fca311/333?text=Helmet+-+Side', 'https://placehold.co/150x100/fca311/333?text=Helmet+-+Vents'], description: 'Lightweight and aerodynamic helmet for road cycling.', brand: 'AeroRide', variant: 'White-M' },
    { id: 'az007', name: 'Basketball Official Size', category: 'Sports', store: 'Active Zone', price: 30.00, image: 'https://placehold.co/400x300/e9d8a6/333?text=Basketball', moreImages: ['https://placehold.co/150x100/e9d8a6/333?text=Ball+-+Texture', 'https://placehold.co/150x100/e9d8a6/333?text=Ball+-+Bounce'], description: 'Durable basketball for indoor and outdoor play.', brand: 'HoopStar', variant: 'Size 7' },
    { id: 'az008', name: 'Soccer Ball Training', category: 'Sports', store: 'Active Zone', price: 22.00, image: 'https://placehold.co/400x300/1a759f/fff?text=Soccer+Ball', moreImages: ['https://placehold.co/150x100/1a759f/fff?text=Ball+-+Close+Up', 'https://placehold.co/150x100/1a759f/fff?text=Ball+-+Flight'], description: 'High-quality soccer ball for practice and casual games.', brand: 'KickMaster', variant: 'Size 5' },
    { id: 'az009', name: 'Tennis Racket Graphite', category: 'Sports', store: 'Active Zone', price: 90.00, image: 'https://placehold.co/400x300/ef233c/fff?text=Tennis+Racket', moreImages: ['https://placehold.co/150x100/ef233c/fff?text=Racket+-+Grip', 'https://placehold.co/150x100/ef233c/fff?text=Racket+-+Strings'], description: 'Lightweight graphite racket for enhanced power and control.', brand: 'SmashPro', variant: 'Grip 2' },
    { id: 'az010', name: 'Swimming Goggles Anti-Fog', category: 'Sports', store: 'Active Zone', price: 15.00, image: 'https://placehold.co/400x300/3a0ca3/fff?text=Swim+Goggles', moreImages: ['https://placehold.co/150x100/3a0ca3/fff?text=Goggles+-+Front', 'https://placehold.co/150x100/3a0ca3/fff?text=Goggles+-+Strap'], description: 'Comfortable and anti-fog goggles for clear underwater vision.', brand: 'DiveClear', variant: 'Blue' },
];

// MOCK STORE DATA
const stores = [
    { id: 'trendy-threads', name: 'Trendy Threads', image: 'https://placehold.co/600x400/a55447/fff?text=Trendy+Threads' },
    { id: 'tech-emporium', name: 'Tech Emporium', image: 'https://placehold.co/600x400/2f5d62/fff?text=Tech+Emporium' },
    { id: 'the-book-nook', name: 'The Book Nook', image: 'https://placehold.co/600x400/4a4e69/fff?text=The+Book+Nook' },
    { id: 'active-zone', name: 'Active Zone', image: 'https://placehold.co/600x400/52b788/fff?text=Active+Zone' },
];

// MOCK CATEGORY DATA
const categories = [
    { name: 'Fashion' },
    { name: 'Mobiles/Computers' },
    { name: 'Books' },
    { name: 'Sports' }
];

// --- Global State & DOM Elements ---
let cartItems = [];
let currentPage = 'main';
const mainPage = document.getElementById('main-page');
const storesPage = document.getElementById('stores-page');
const categoryPage = document.getElementById('category-page');
const cartPage = document.getElementById('cart-page');
const productDetailPage = document.getElementById('product-detail-page');
const cartIconMain = document.getElementById('cart-icon');
const cartCountMain = document.getElementById('cart-count');
const cartIconCategory = document.getElementById('cart-icon-category');
const cartCountCategory = document.getElementById('cart-count-category');
const cartIconStore = document.getElementById('cart-icon-store');
const cartCountStore = document.getElementById('cart-count-store');
const storesContainer = document.getElementById('stores-container');
const categoriesContainer = document.getElementById('categories-container');
const productList = document.getElementById('product-list');
const backToMainBtnCategory = document.getElementById('back-to-main-btn-category');
const backToMainBtnCart = document.getElementById('back-to-main-btn-cart');
const backFromDetailBtn = document.getElementById('back-from-detail-btn');
const productDetailImage = document.getElementById('product-image');
const productDetailName = document.getElementById('product-name');
const productDetailCategory = document.getElementById('product-category');
const productDetailDescription = document.getElementById('product-description');
const productDetailPrice = document.getElementById('product-price');
const detailAddToCartBtn = document.getElementById('detail-add-to-cart-btn');
const toggleDetailsBtn = document.getElementById('toggle-details-btn');
const allDetailsSection = document.getElementById('all-details-section');
const reviewsDisplayArea = document.getElementById('reviews-display-area');
const reviewRatingSelect = document.getElementById('review-rating');
const reviewTextarea = document.getElementById('review-text');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartTotalSpan = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const emptyCartMessage = document.getElementById('empty-cart-message');
const cartSummary = document.getElementById('cart-summary');
const categoryPageTitle = document.getElementById('category-page-title');
const storePageTitle = document.getElementById('store-page-title');
const backToMainBtnStore = document.getElementById('back-to-main-btn-store');
const signOutBtn = document.getElementById('sign-out-btn');
        
let productDetailStartTime = null;

// Image viewer elements
const imageViewer = document.getElementById('image-viewer');
const sliderWrapper = document.getElementById('slider-images-wrapper');
const sliderPrevBtn = document.getElementById('slider-prev-btn');
const sliderNextBtn = document.getElementById('slider-next-btn');
let currentImageIndex = 0;
let currentImageUrls = [];
let zoomStartTime = null;

function showImageViewer(imageUrls, startIndex = 0) {
    currentImageUrls = imageUrls;
    currentImageIndex = startIndex;
    
    if (sliderWrapper) {
        sliderWrapper.innerHTML = '';
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Product image ${index + 1}`;
            img.className = 'slider-image';
            if (sliderWrapper) {
                sliderWrapper.appendChild(img);
            }
        });
        updateSliderPosition();
    }

    if (imageViewer) {
        imageViewer.classList.add('visible');
    }
    document.body.style.overflow = 'hidden';

    if (imageUrls.length > 1) {
        if (sliderPrevBtn) sliderPrevBtn.classList.remove('hidden');
        if (sliderNextBtn) sliderNextBtn.classList.remove('hidden');
    } else {
        if (sliderPrevBtn) sliderPrevBtn.classList.add('hidden');
        if (sliderNextBtn) sliderNextBtn.classList.add('hidden');
    }
    const activePageElement = document.querySelector('#product-detail-page:not(.hidden)');
    if (activePageElement) {
        const productId = window.location.hash.split('=')[1];
        const product = products.find(p => p.id === productId);
        if (product) {
            zoomStartTime = Date.now();
            EventTracker.track('zooming', {
                zoom_level: 1,
                item: {
                    item_id: product.id,
                    item_name: product.name,
                    image_details: {
                        image_url: imageUrls[startIndex],
                        image_position: startIndex + 1,
                    },
                },
            });
        }
    }
}
function hideImageViewer() {
    if (zoomStartTime) {
        const zoomDurationSeconds = Math.round((Date.now() - zoomStartTime) / 1000);
        const productId = window.location.hash.split('=')[1];
        const product = products.find(p => p.id === productId);
        if (product) {
            EventTracker.track('zooming', {
                zoom_level: 1,
                zoom_duration_seconds: zoomDurationSeconds,
                item: {
                    item_id: product.id,
                    item_name: product.name,
                    image_details: {
                        image_url: currentImageUrls[currentImageIndex],
                        image_position: currentImageIndex + 1,
                    },
                },
            });
        }
        zoomStartTime = null;
    }
    if (imageViewer) {
        imageViewer.classList.remove('visible');
    }
    document.body.style.overflow = 'auto';
}
function updateSliderPosition() {
    if (!sliderWrapper) return;
    const images = sliderWrapper.querySelectorAll('.slider-image');
    images.forEach((img, index) => {
        img.style.display = index === currentImageIndex ? 'block' : 'none';
    });
}
function showNextImage() {
    if (currentImageUrls.length <= 1) return;
    currentImageIndex = (currentImageIndex + 1) % currentImageUrls.length;
    updateSliderPosition();
}
function showPrevImage() {
    if (currentImageUrls.length <= 1) return;
    currentImageIndex = (currentImageIndex - 1 + currentImageUrls.length) % currentImageUrls.length;
    updateSliderPosition();
}

const signOut = () => {
    EventTracker.clearUserId();
    showPage('main');
};


if(document.getElementById('image-viewer-close-btn')) document.getElementById('image-viewer-close-btn').addEventListener('click', hideImageViewer);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageViewer && imageViewer.classList.contains('visible')) {
        hideImageViewer();
    }
    if (e.key === 'ArrowRight' && imageViewer && imageViewer.classList.contains('visible')) {
        showNextImage();
    }
    if (e.key === 'ArrowLeft' && imageViewer && imageViewer.classList.contains('visible')) {
        showPrevImage();
    }
});
if(sliderNextBtn) sliderNextBtn.addEventListener('click', showNextImage);
if(sliderPrevBtn) sliderPrevBtn.addEventListener('click', showPrevImage);

function hideAllPages() {
    if(mainPage) mainPage.classList.add('hidden');
    if(storesPage) storesPage.classList.add('hidden');
    if(categoryPage) categoryPage.classList.add('hidden');
    if(cartPage) cartPage.classList.add('hidden');
    if(productDetailPage) productDetailPage.classList.add('hidden');
}

function showPage(pageName, options = {}) {
    hideAllPages();
    currentPage = pageName;

    let newHash = '';
    if (pageName === 'store' && options.storeName) {
        newHash = `store=${encodeURIComponent(options.storeName)}`;
    } else if (pageName === 'category' && options.category) {
        newHash = `category=${encodeURIComponent(options.category)}`;
    } else if (pageName === 'product-detail' && options.productId) {
        newHash = `product=${options.productId}`;
    } else if (pageName === 'cart') {
        newHash = 'cart';
    } else if (pageName === 'main') {
        newHash = '';
    }

    if (window.location.hash.substring(1) !== newHash) {
        window.location.hash = newHash;
    }
    
    EventTracker.track('view_page');

    switch (pageName) {
        case 'main':
            if (mainPage) mainPage.classList.remove('hidden');
            renderStores();
            renderCategories();
            const filteredProducts = products.filter(p => p.category && p.store);
            renderProducts(filteredProducts, productList);
            updateCartCounts();
            break;
        case 'store':
            if (storesPage) storesPage.classList.remove('hidden');
            const storeProducts = products.filter(p => p.store === options.storeName);
            if (storePageTitle) storePageTitle.textContent = options.storeName;
            if (document.getElementById('store-product-list')) renderProducts(storeProducts, document.getElementById('store-product-list'));
            updateCartCounts();
            EventTracker.track('store_visit', {
                store_name: options.storeName,
                seller_id: EventTracker.getSellerId(options.storeName),
            });
            break;
        case 'category':
            if (categoryPage) categoryPage.classList.remove('hidden');
            const productsByCategory = products.filter(p => p.category === options.category);
            if (categoryPageTitle) categoryPageTitle.textContent = options.category;
            if (document.getElementById('category-product-list')) renderProducts(productsByCategory, document.getElementById('category-product-list'));
            updateCartCounts();
            break;
        case 'cart':
            if (cartPage) cartPage.classList.remove('hidden');
            renderCart();
            updateCartCounts();
            break;
        case 'product-detail':
            if (productDetailPage) productDetailPage.classList.remove('hidden');
            renderProductDetail(options.productId);
            updateCartCounts();
            break;
        default:
            showPage('main');
    }
}

function renderStores() {
    if (!storesContainer) return;
    storesContainer.innerHTML = '';
    stores.forEach(store => {
        const card = document.createElement('a');
        card.href = `#store=${encodeURIComponent(store.name)}`;
        card.className = 'store-card';
        card.innerHTML = `<h3 class="z-10">${store.name}</h3>`;
        if(storesContainer) storesContainer.appendChild(card);
    });
}


function renderProducts(productsToRender, container) {
    if (!container) return;
    container.innerHTML = '';
    if (productsToRender.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center col-span-full">No products found.</p>';
        return;
    }

    productsToRender.slice(0, 10).forEach((product, index) => {
        const isBestSeller = index < 4;
        const productCard = document.createElement('a');
        productCard.href = `#product=${product.id}`;
        productCard.className = 'product-card block';
        productCard.innerHTML = `
            ${isBestSeller ? '<span class="best-seller-tag">Best Seller</span>' : ''}
            <img src="${product.image}" alt="${product.name}">
            <div class="product-card-body">
                <p class="category">${product.category}</p>
                <h3 class="h-12 overflow-hidden">${product.name}</h3>
                <p class="price">$${product.price.toFixed(2)}</p>
            </div>
        `;
        if(container) container.appendChild(productCard);
    });
}


function renderProductDetail(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        if(productDetailPage) productDetailPage.innerHTML = '<p class="text-red-500 text-center">Product not found.</p>';
        return;
    }
    
    const sellerId = EventTracker.getSellerId(product.store);

    EventTracker.track('view_item', {
        seller_id: sellerId,
        store_name: product.store,
        item: {
            item_id: product.id,
            item_name: product.name,
            price: product.price,
            item_category: product.category,
            item_brand: product.brand,
            item_variant: product.variant,
        }
    });
    productDetailStartTime = Date.now();

    if (productDetailImage) productDetailImage.src = product.image;
    if (productDetailImage) productDetailImage.alt = product.name;
    if (productDetailName) productDetailName.textContent = product.name;
    if (productDetailCategory) productDetailCategory.textContent = product.category;
    if (productDetailDescription) productDetailDescription.textContent = product.description;
    if (productDetailPrice) productDetailPrice.textContent = `$${product.price.toFixed(2)}`;
    if (detailAddToCartBtn) detailAddToCartBtn.dataset.productId = product.id;

    const thumbnailGallery = document.getElementById('thumbnail-gallery');
    const allImages = [product.image, ...(product.moreImages || [])];
    if (thumbnailGallery) {
        thumbnailGallery.innerHTML = '';
        allImages.forEach((imgUrl, index) => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = `${product.name} - Image ${index + 1}`;
            img.className = 'cursor-pointer';
            if (index === 0) {
                img.classList.add('active');
            }
            img.addEventListener('click', () => {
                if (productDetailImage) productDetailImage.src = imgUrl;
                document.querySelectorAll('#thumbnail-gallery img').forEach(i => i.classList.remove('active'));
                img.classList.add('active');
            });
            thumbnailGallery.appendChild(img);
        });
    }

    if (document.getElementById('product-image')) document.getElementById('product-image').addEventListener('click', () => showImageViewer(allImages, 0));
    if (thumbnailGallery) {
        thumbnailGallery.querySelectorAll('img').forEach((img, index) => {
            img.addEventListener('click', () => showImageViewer(allImages, index));
        });
    }

    const existingReviewsSection = document.getElementById('reviews-section');
    if (existingReviewsSection) existingReviewsSection.remove();
    
    renderReviewSection(productId);
    renderReviews(productId, 2);

    const allDetailsSection = document.getElementById('all-details-section');
    if (allDetailsSection) {
        allDetailsSection.innerHTML = `
            <h5 class="text-xl font-bold mb-4">Product Specifications</h5>
            <p><strong>Brand:</strong> ${product.brand || 'N/A'}</p>
            <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
            <p><strong>Variant:</strong> ${product.variant || 'N/A'}</p>
            <p><strong>Description:</strong> ${product.description || 'N/A'}</p>
            <p><strong>Product ID:</strong> ${product.id}</p>
        `;
        allDetailsSection.classList.add('hidden');
    }

    if (toggleDetailsBtn) {
        toggleDetailsBtn.textContent = 'Show All Details';
    
        toggleDetailsBtn.onclick = () => {
            if (allDetailsSection) {
                const isHidden = allDetailsSection.classList.toggle('hidden');
                toggleDetailsBtn.textContent = isHidden ? 'Show All Details' : 'Hide Details';
                if (!isHidden) {
                    EventTracker.track('view_product_details', {
                        seller_id: sellerId,
                        item: {
                            item_id: product.id,
                            item_name: product.name,
                            item_category: product.category,
                            price: product.price,
                            item_brand: product.brand,
                            item_variant: product.variant,
                        },
                    });
                }
            }
        };
    }
    
    if (detailAddToCartBtn) {
        detailAddToCartBtn.onclick = (event) => {
            const id = event.target.dataset.productId;
            addToCart(id);
        };
    }
}


function renderReviewSection(productId) {
    const reviewsSectionHtml = `
        <div id="reviews-section" class="mt-8">
            <h3 class="text-4xl font-bold mb-4">Customer Reviews</h3>
            <div id="reviews-display-area" class="space-y-4 mb-6"></div>
            <button id="view-reviews-btn" class="btn btn-secondary text-xl">View All Reviews</button>
            <h4 class="3xl font-bold mt-8 mb-4">Submit Your Review</h4>
            <div class="flex items-center mb-4">
                <label for="review-rating" class="mr-2">Rating:</label>
                <select id="review-rating" class="form-control w-auto">
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                </select>
            </div>
            <textarea id="review-text" class="form-control" rows="4" placeholder="Write your review here..."></textarea>
            <button id="submit-review-btn" class="btn btn-primary text-xl mt-4">Submit Review</button>
        </div>
    `;
    const productDetailPageContainer = document.getElementById('product-detail-page');
    if(productDetailPageContainer) {
        productDetailPageContainer.insertAdjacentHTML('beforeend', reviewsSectionHtml);
    }

    if(document.getElementById('submit-review-btn')) document.getElementById('submit-review-btn').addEventListener('click', () => {
        const rating = document.getElementById('review-rating').value;
        const reviewText = document.getElementById('review-text').value.trim();
        submitReview(productId, rating, reviewText);
    });
    
    const viewReviewsBtn = document.getElementById('view-reviews-btn');
    if (viewReviewsBtn) {
        viewReviewsBtn.addEventListener('click', () => {
            const isShowingAll = viewReviewsBtn.textContent === 'View Few Reviews';
            if (isShowingAll) {
                renderReviews(productId, 2);
            } else {
                renderReviews(productId, -1);
            }
        });
    }
}


function submitReview(productId, rating, reviewText) {
    if (reviewText === "") {
        alertMessage("Please write your review before submitting.");
        return;
    }
    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found for review submission.');
        return;
    }
    
    const reviewId = 'review-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const sellerId = EventTracker.getSellerId(product.store);

    EventTracker.track('user_reviews', {
        seller_id: sellerId,
        store_name: product.store,
        item: { 
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            price: product.price,
        },
        review: { 
            review_id: reviewId, 
            product_id: productId,
            rating: parseInt(rating),
            review_text: reviewText,
            reviewer_name: 'Anonymous User',
            review_images_count: 0,
        }
    });
    
    alertMessage('Review submitted! (Demo)');
    if(document.getElementById('review-rating')) document.getElementById('review-rating').value = '5';
    if(document.getElementById('review-text')) document.getElementById('review-text').value = '';
}

function renderReviews(productId, count = 2) {
    const mockReviews = [
        { user: 'Alice', rating: 5, text: 'Absolutely love this product! Highly recommend.', timestamp: '2025-07-20', image: 'https://placehold.co/100x100/52b788/fff?text=Review+1' },
        { user: 'Bob', rating: 4, text: 'Good quality, met my expectations.', timestamp: '2025-07-22', image: 'https://placehold.co/100x100/e0b686/fff?text=Review+2' },
        { user: 'Charlie', rating: 5, text: 'Great product and fast delivery.', timestamp: '2025-07-25', image: 'https://placehold.co/100x100/fca311/333?text=Review+3' },
        { user: 'Diana', rating: 3, text: 'It was okay, not what I expected.', timestamp: '2025-07-28', image: 'https://placehold.co/100x100/94b0da/333?text=Review+4' },
    ];

    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found for review tracking.');
        return;
    }
    
    const sellerId = EventTracker.getSellerId(product.store);

    const reviewsToRender = count === -1 ? mockReviews : mockReviews.slice(0, count);

    EventTracker.track('view_user_reviews', {
        seller_id: sellerId,
        store_name: product.store,
        viewed_reviews_count: reviewsToRender.length,
        item: { item_id: product.id, item_name: product.name, item_category: product.category, price: product.price },
    });

    const reviewsDisplayArea = document.getElementById('reviews-display-area');
    const viewReviewsBtn = document.getElementById('view-reviews-btn');

    if (reviewsDisplayArea) {
        reviewsDisplayArea.innerHTML = '';
        if (reviewsToRender.length > 0) {
            reviewsToRender.forEach(review => {
                const reviewDiv = document.createElement('div');
                reviewDiv.className = 'review-div bg-white p-4 rounded-md shadow-sm border border-gray-200';
                reviewDiv.innerHTML = `
                    <div class="flex items-center mb-2">
                        <span class="font-semibold text-[#a55447] mr-2 text-xl">${review.user}</span>
                        <span class="text-yellow-500 text-lg">${'⭐'.repeat(review.rating)}</span>
                    </div>
                    <p class="text-gray-700 text-lg mb-2">${review.text}</p>
                    ${review.image ? `<img src="${review.image}" alt="Review image" class="w-24 h-24 object-cover rounded-md mt-2 cursor-pointer review-image-click">` : ''}
                    <p class="text-gray-500 text-base text-right">Reviewed on ${review.timestamp}</p>
                `;
                reviewsDisplayArea.appendChild(reviewDiv);
            });
            reviewsDisplayArea.querySelectorAll('.review-image-click').forEach(img => {
                img.addEventListener('click', () => {
                    showImageViewer([img.src]);
                });
            });
        } else {
            reviewsDisplayArea.innerHTML = '<p class="text-gray-500">No reviews yet. Be the first to review!</p>';
        }

        if (mockReviews.length > 2) {
             if(viewReviewsBtn) viewReviewsBtn.classList.remove('hidden');
             if (count === -1) {
                if(viewReviewsBtn) viewReviewsBtn.textContent = 'View Few Reviews';
             } else {
                if(viewReviewsBtn) viewReviewsBtn.textContent = 'View All Reviews';
             }
        } else {
            if(viewReviewsBtn) viewReviewsBtn.classList.add('hidden');
        }
    }
}

function renderCategories() {
    if (!categoriesContainer) return;
    categoriesContainer.innerHTML = '';
    stores.forEach(store => {
        const card = document.createElement('a');
        card.href = `#store=${encodeURIComponent(store.name)}`;
        card.className = 'category-card';
        card.innerHTML = `<h3 class="text-lg font-semibold">${store.name}</h3>`;
        categoriesContainer.appendChild(card);
    });
}

function addToCart(productId) {
    const existingItem = cartItems.find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cartItems.push({ productId: productId, quantity: 1 });
    }
    updateCartCounts();
    alertMessage('Product added to cart!');
}

function updateCartCounts() {
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const counts = [cartCountMain, cartCountCategory, cartIconStore, cartCountStore];
    counts.forEach(countEl => {
        if (countEl) {
            if (totalItems > 0) {
                countEl.textContent = totalItems;
                countEl.classList.remove('hidden');
            } else {
                countEl.classList.add('hidden');
            }
        }
    });
}

function renderCart() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';
    let total = 0;
    if (cartItems.length === 0) {
        if (emptyCartMessage) emptyCartMessage.classList.remove('hidden');
        if (cartSummary) cartSummary.classList.add('hidden');
        return;
    } else {
        if (emptyCartMessage) emptyCartMessage.classList.add('hidden');
        if (cartSummary) cartSummary.classList.remove('hidden');
    }

    cartItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            const itemTotal = product.price * item.quantity;
            total += itemTotal;
            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'flex items-center justify-between bg-white p-4 rounded-lg shadow-sm';
            cartItemDiv.innerHTML = `
                <div class="flex items-center">
                    <img src="${product.image}" alt="${product.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                    <div>
                        <h3 class="text-lg font-semibold">${product.name}</h3>
                        <p class="text-gray-600">Quantity: ${item.quantity}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-bold text-[#a55447]">$${itemTotal.toFixed(2)}</p>
                    <button class="remove-from-cart-btn text-red-500 hover:text-red-700 text-sm mt-1" data-product-id="${product.id}">Remove</button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        }
    });
    if(cartTotalSpan) cartTotalSpan.textContent = total.toFixed(2);
    cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.productId;
            removeItemFromCart(productId);
        });
    });
}

function alertMessage(message) {
    const messageBox = document.createElement('div');
    messageBox.className = 'fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-transform duration-300 transform translate-x-full';
    messageBox.textContent = message;
    document.body.appendChild(messageBox);
    setTimeout(() => {
        messageBox.classList.remove('translate-x-full');
    }, 50);
    setTimeout(() => {
        messageBox.classList.add('translate-x-full');
        messageBox.addEventListener('transitionend', () => messageBox.remove());
    }, 3000);
}

function removeItemFromCart(productId) {
    cartItems = cartItems.filter(item => {
        if (item.productId === productId) {
            const product = products.find(p => p.id === productId);
            if (product) {
                EventTracker.track('remove_from_cart', {
                    item: {
                        item_id: product.id,
                        item_name: product.name,
                        item_category: product.category,
                        price: product.price,
                        quantity: item.quantity
                    }
                });
            }
            return false;
        }
        return true;
    });
    updateCartCounts();
    renderCart();
    alertMessage('Item removed from cart.');
}

function handleHashChange() {
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('store=')) {
        const storeName = decodeURIComponent(hash.split('=')[1]);
        showPage('store', { storeName });
    } else if (hash.startsWith('category=')) {
        const category = decodeURIComponent(hash.split('=')[1]);
        showPage('category', { category });
    } else if (hash.startsWith('product=')) {
        const productId = hash.split('=')[1];
        showPage('product-detail', { productId });
    } else if (hash === 'cart') {
        showPage('cart');
    } else {
        showPage('main');
    }
}

const cartIcons = [cartIconMain, cartIconCategory, cartIconStore];
cartIcons.forEach(icon => {
    if (icon) {
        icon.addEventListener('click', () => showPage('cart'));
    }
});

if (backToMainBtnCategory) backToMainBtnCategory.addEventListener('click', () => window.location.hash = '');
if (backToMainBtnCart) backToMainBtnCart.addEventListener('click', () => window.location.hash = '');
if (backFromDetailBtn) backFromDetailBtn.addEventListener('click', () => {
    if (productDetailStartTime) {
        const pageDurationSeconds = Math.round((Date.now() - productDetailStartTime) / 1000);
        const productId = window.location.hash.split('=')[1];
        const product = products.find(p => p.id === productId);
        if (product) {
             EventTracker.track('view_item', {
                seller_id: EventTracker.getSellerId(product.store),
                store_name: product.store,
                item: {
                    item_id: product.id,
                    item_name: product.name,
                    item_category: product.category,
                    price: product.price,
                    item_brand: product.brand,
                    item_variant: product.variant,
                },
                page_duration_seconds: pageDurationSeconds,
            });
        }
    }
    window.history.back();
});
if (backToMainBtnStore) backToMainBtnStore.addEventListener('click', () => window.location.hash = '');

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cartItems.length > 0) {
            alertMessage('Proceeding to checkout! (This is a demo)');
            cartItems = [];
            updateCartCounts();
            renderCart();
        } else {
            alertMessage('Your cart is empty!');
        }
    });
}

window.addEventListener('hashchange', handleHashChange);
window.addEventListener('popstate', handleHashChange);

document.addEventListener('DOMContentLoaded', () => {
    EventTracker.setUserId('anon-user');
    EventTracker.init();
    handleHashChange();
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }
});