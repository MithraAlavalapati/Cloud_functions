document.addEventListener('DOMContentLoaded', () => {
    const backendUrl = 'http://localhost:5000';
    
    // Logic for the index.html page
    if (document.querySelector('.product-grid')) {
        const fetchAllProducts = () => {
            fetch(`${backendUrl}/api/products`)
                .then(res => res.json())
                .then(products => {
                    const productGrid = document.querySelector('.product-grid');
                    if (products.length > 0) {
                        productGrid.innerHTML = products.map(product => `
                            <div class="product-card">
                                <a href="product.html?id=${product.id}">
                                    <img src="${product.image_url || 'https://via.placeholder.com/400x300/f0f0f0?text=Product'}" alt="${product.name}">
                                    <div class="product-info">
                                        <h3>${product.name}</h3>
                                        <div class="rating">
                                            <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="far fa-star"></i>
                                        </div>
                                        <p class="price">
                                            <span class="discounted-price">₹${product.price}</span>
                                            <span class="original-price">₹${product.price + 1000}</span>
                                        </p>
                                    </div>
                                </a>
                                <button class="add-to-cart-btn" data-product-id="${product.id}">Add to Cart</button>
                            </div>
                        `).join('');
                    } else {
                        productGrid.innerHTML = `<p class="text-center text-secondary">No products available yet.</p>`;
                    }
                })
                .catch(error => {
                    console.error('Error fetching products:', error);
                    document.querySelector('.product-grid').innerHTML = `<p class="text-center text-danger">Failed to load products. Please try again.</p>`;
                });
        };
        fetchAllProducts();
    }
    
    // Logic for seller_dashboard.html page
    if (document.querySelector('#upload-form')) {
        // Fetch and display seller's products
        const fetchSellerProducts = () => {
            fetch(`${backendUrl}/api/seller/products`)
                .then(res => res.json())
                .then(data => {
                    const productsContainer = document.getElementById('seller-products');
                    if (data.success && data.products.length > 0) {
                        productsContainer.innerHTML = data.products.map(p => `
                            <div class="product-card">
                                <img src="${p.image_url || 'https://via.placeholder.com/400x300/f8f9fa?text=Product'}" alt="${p.name}">
                                <h5>${p.name}</h5>
                                <p class="text-muted">₹${p.price}</p>
                            </div>
                        `).join('');
                    } else {
                        productsContainer.innerHTML = `<p class="text-center w-100 text-secondary">You have not uploaded any products yet.</p>`;
                    }
                })
                .catch(error => {
                    console.error('Error fetching seller products:', error);
                    document.getElementById('seller-products').innerHTML = `<p class="text-center text-danger w-100">Failed to load products. Please try again.</p>`;
                });
        };

        // Fetch and display seller's analytics
        const fetchSellerAnalytics = () => {
            fetch(`${backendUrl}/api/seller/analytics`)
                .then(res => res.json())
                .then(data => {
                    const analyticsContainer = document.getElementById('seller-analytics');
                    if (data.success && Object.keys(data.data).length > 0) {
                        let analyticsHtml = '';
                        for (const productId in data.data) {
                            analyticsHtml += `
                                <div class="col-md-6">
                                    <div class="card shadow-sm h-100">
                                        <div class="card-body">
                                            <h5 class="card-title">Analytics for Product ID: ${productId}</h5>
                                            <ul class="list-group list-group-flush">
                                                ${Object.keys(data.data[productId]).map(userId => `
                                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                                        User ${userId}
                                                        <span class="badge bg-primary rounded-pill">Views: ${data.data[productId][userId].views}</span>
                                                    </li>
                                                `).join('')}
                                            </ul>
                                        </div>
                                    </div>
                                </div>`;
                        }
                        analyticsContainer.innerHTML = analyticsHtml;
                    } else {
                        analyticsContainer.innerHTML = `<p class="text-center text-secondary w-100">No customer analytics available yet.</p>`;
                    }
                })
                .catch(error => {
                    console.error('Error fetching analytics:', error);
                    document.getElementById('seller-analytics').innerHTML = `<p class="text-center text-danger w-100">Failed to load analytics. Please try again.</p>`;
                });
        };
        
        // Initial load of content
        fetchSellerProducts();
        fetchSellerAnalytics();

        // Handle product upload form submission
        document.getElementById('upload-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('name', document.getElementById('product-name').value);
            formData.append('description', document.getElementById('product-description').value);
            formData.append('price', document.getElementById('product-price').value);
            formData.append('image', document.getElementById('product-image').files[0]);

            fetch(`${backendUrl}/api/seller/upload_product`, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert('Product uploaded successfully!');
                    window.location.reload(); 
                } else {
                    alert('Failed to upload product: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error uploading product:', error);
                alert('An error occurred. Please try again.');
            });
        });
    }

    // Logic for left navigation tabs
    if (document.querySelector('.sidebar-nav')) {
        const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
        const contentSections = document.querySelectorAll('.content-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                contentSections.forEach(section => section.classList.remove('active-content'));
                navLinks.forEach(nav => nav.classList.remove('active-link'));

                const targetId = e.target.closest('.nav-link').getAttribute('data-target');
                if (targetId) {
                    const targetSection = document.querySelector(targetId);
                    if (targetSection) {
                        targetSection.classList.add('active-content');
                        e.target.closest('.nav-link').classList.add('active-link');
                    }
                }
            });
        });
    }

});