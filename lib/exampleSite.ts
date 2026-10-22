// Few-shot quality anchor for the builder system prompt. Claude sees this
// complete restaurant site before generating anything, so it matches this
// bar — structural quality, content depth, and interaction polish — for
// every industry, not just restaurants.

export const EXAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Saffron Kitchen — Authentic Pakistani Cuisine in Gulberg, Lahore</title>
  <meta name="description" content="Family recipes passed down three generations, served in the heart of Gulberg, Lahore. Reserve your table at Saffron Kitchen today." />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <nav class="nav">
    <div class="container">
      <a href="#" class="nav-logo">Saffron Kitchen</a>
      <ul class="nav-links">
        <li><a href="#menu">Menu</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#reviews">Reviews</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <a href="#contact" class="nav-cta">Reserve Table</a>
      <button class="nav-toggle" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="nav-mobile">
      <button class="nav-mobile-close" aria-label="Close menu">✕</button>
      <a href="#menu">Menu</a>
      <a href="#about">About</a>
      <a href="#reviews">Reviews</a>
      <a href="#contact">Contact</a>
      <a href="#contact" class="btn btn-primary">Reserve Table</a>
    </div>
  </nav>

  <main>
    <section class="hero reveal">
      <div class="container">
        <h1>Authentic Flavors, Modern Experience</h1>
        <p>Family recipes passed down three generations, served in the heart of Gulberg, Lahore.</p>
        <div class="hero-buttons">
          <a href="#menu" class="btn btn-primary">View Our Menu</a>
          <a href="#contact" class="btn btn-outline">Reserve a Table</a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="stats reveal">
          <div>
            <div class="stat-number" data-count="15" data-suffix="+">0</div>
            <div class="stat-label">Years of Legacy</div>
          </div>
          <div>
            <div class="stat-number" data-count="200" data-suffix="+">0</div>
            <div class="stat-label">Dishes Perfected</div>
          </div>
          <div>
            <div class="stat-number" data-count="50000" data-suffix="+">0</div>
            <div class="stat-label">Happy Guests</div>
          </div>
          <div>
            <div class="stat-number" data-count="4.8" data-decimal="1" data-suffix="★">0</div>
            <div class="stat-label">Average Rating</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="menu">
      <div class="container">
        <div class="reveal" style="text-align: center; max-width: 600px; margin: 0 auto var(--space-12);">
          <h2>From Our Kitchen to Your Table</h2>
          <p style="margin: var(--space-4) auto 0; color: var(--color-text-light);">Six signature dishes our guests order again and again.</p>
        </div>

        <div class="menu-filters reveal">
          <button class="menu-filter-btn active" data-filter="all">All</button>
          <button class="menu-filter-btn" data-filter="starters">Starters</button>
          <button class="menu-filter-btn" data-filter="main-course">Main Course</button>
          <button class="menu-filter-btn" data-filter="vegetarian">Vegetarian</button>
          <button class="menu-filter-btn" data-filter="breads">Breads</button>
          <button class="menu-filter-btn" data-filter="desserts">Desserts</button>
        </div>

        <div class="grid-3">
          <article class="card reveal" data-category="main-course">
            <div class="card-body">
              <div class="flex-between">
                <span class="menu-category-tag">Main Course</span>
                <span class="menu-price">Rs. 1,450</span>
              </div>
              <h3>Chicken Karahi</h3>
              <p>Tender chicken simmered in a rich tomato-ginger gravy, finished with fresh coriander and green chilies.</p>
            </div>
          </article>

          <article class="card reveal reveal-delay-1" data-category="starters">
            <div class="card-body">
              <div class="flex-between">
                <span class="menu-category-tag">Starters</span>
                <span class="menu-price">Rs. 650</span>
              </div>
              <h3>Seekh Kebab</h3>
              <p>Char-grilled minced beef skewers, hand-spiced with garam masala and served with fresh mint chutney.</p>
            </div>
          </article>

          <article class="card reveal reveal-delay-2" data-category="main-course">
            <div class="card-body">
              <div class="flex-between">
                <span class="menu-category-tag">Main Course</span>
                <span class="menu-price">Rs. 1,650</span>
              </div>
              <h3>Mutton Biryani</h3>
              <p>Fragrant basmati layered with slow-cooked mutton, saffron, and caramelized onions.</p>
            </div>
          </article>

          <article class="card reveal" data-category="vegetarian">
            <div class="card-body">
              <div class="flex-between">
                <span class="menu-category-tag">Vegetarian</span>
                <span class="menu-price">Rs. 750</span>
              </div>
              <h3>Dal Makhni</h3>
              <p>Black lentils simmered overnight with butter and cream, finished with a smoky tempering.</p>
            </div>
          </article>

          <article class="card reveal reveal-delay-1" data-category="breads">
            <div class="card-body">
              <div class="flex-between">
                <span class="menu-category-tag">Breads</span>
                <span class="menu-price">Rs. 450</span>
              </div>
              <h3>Naan Platter</h3>
              <p>Assorted tandoor breads — plain, garlic, and stuffed kalonji naan — baked fresh to order.</p>
            </div>
          </article>

          <article class="card reveal reveal-delay-2" data-category="desserts">
            <div class="card-body">
              <div class="flex-between">
                <span class="menu-category-tag">Desserts</span>
                <span class="menu-price">Rs. 350</span>
              </div>
              <h3>Gulab Jamun</h3>
              <p>Warm milk dumplings soaked in cardamom-rose syrup, served with a scoop of kulfi.</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section" id="about">
      <div class="container">
        <div class="hero-split reveal">
          <div>
            <h2>Three Generations of Flavor</h2>
            <p>Founded in 1998 by the Ahmed family, Saffron Kitchen began as a small roadside dhaba serving factory workers on Ferozepur Road. My grandfather's karahi recipe — cooked over open flame, never rushed — became the reason people crossed the city.</p>
            <p style="margin-top: var(--space-4);">Today, that same recipe anchors our menu in Gulberg, alongside dishes my mother perfected over two decades. Every plate that leaves our kitchen still answers to her taste test first.</p>
          </div>
          <div class="about-decor"></div>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="reviews">
      <div class="container">
        <div class="reveal" style="text-align: center; max-width: 600px; margin: 0 auto var(--space-12);">
          <h2>What Our Guests Say</h2>
        </div>
        <div class="grid-3">
          <div class="testimonial reveal">
            <p>"The karahi here is unmatched — tastes exactly like my grandmother's cooking. We've been coming every Friday for three years."</p>
            <div class="testimonial-author">
              <div class="testimonial-avatar">FA</div>
              <div>
                <div class="testimonial-name">Fatima Ahmed</div>
                <div class="testimonial-title">Regular Guest</div>
              </div>
            </div>
          </div>
          <div class="testimonial reveal reveal-delay-1">
            <p>"Booked for a family dinner of twelve and the staff handled it beautifully. The biryani alone is worth the drive from DHA."</p>
            <div class="testimonial-author">
              <div class="testimonial-avatar">BK</div>
              <div>
                <div class="testimonial-name">Bilal Khan</div>
                <div class="testimonial-title">Regular Guest</div>
              </div>
            </div>
          </div>
          <div class="testimonial reveal reveal-delay-2">
            <p>"Warm service, generous portions, and the gulab jamun is still warm when it reaches the table. My go-to for celebrations."</p>
            <div class="testimonial-author">
              <div class="testimonial-avatar">AS</div>
              <div>
                <div class="testimonial-name">Ayesha Siddiqui</div>
                <div class="testimonial-title">Regular Guest</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-section reveal">
          <h2>Your Table is Waiting</h2>
          <p>Call us at +92 42 3587 6421 or reserve online — walk-ins are always welcome too.</p>
          <a href="tel:+924235876421" class="btn btn-primary">Reserve a Table</a>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="contact">
      <div class="container">
        <div class="grid-2 reveal">
          <div>
            <h2>Visit Us</h2>
            <p>Drop by for lunch, dinner, or a private family gathering — we take walk-ins and reservations alike.</p>
            <div class="contact-info">
              <div class="contact-item">
                <strong>Address</strong>
                <span>12-C, Gulberg III, Main Boulevard, Lahore, Punjab 54660</span>
              </div>
              <div class="contact-item">
                <strong>Phone</strong>
                <span>+92 42 3587 6421</span>
              </div>
              <div class="contact-item">
                <strong>Email</strong>
                <span>reservations@saffronkitchen.pk</span>
              </div>
            </div>
            <table class="hours-table">
              <tbody>
                <tr><td>Monday – Thursday</td><td>12:00 PM – 11:00 PM</td></tr>
                <tr><td>Friday – Sunday</td><td>12:00 PM – 12:30 AM</td></tr>
              </tbody>
            </table>
          </div>

          <form class="contact-form" id="contactForm" novalidate>
            <div class="form-group">
              <label class="form-label" for="name">Name</label>
              <input class="form-input" type="text" id="name" name="name" />
              <span class="form-error" data-error-for="name"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="email">Email</label>
              <input class="form-input" type="email" id="email" name="email" />
              <span class="form-error" data-error-for="email"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="phone">Phone</label>
              <input class="form-input" type="tel" id="phone" name="phone" />
              <span class="form-error" data-error-for="phone"></span>
            </div>
            <div class="form-group">
              <label class="form-label" for="message">Message</label>
              <textarea class="form-textarea" id="message" name="message"></textarea>
              <span class="form-error" data-error-for="message"></span>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">Send Message</button>
          </form>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-logo">Saffron Kitchen</div>
          <p class="footer-description">Authentic Pakistani cuisine rooted in family tradition, served fresh in the heart of Lahore since 1998.</p>
          <div class="footer-social">
            <a href="#" aria-label="Facebook">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="#" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
            </a>
            <a href="#" aria-label="WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <div class="footer-heading">Quick Links</div>
          <ul class="footer-links">
            <li><a href="#menu">Menu</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#reviews">Reviews</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">Hours</div>
          <ul class="footer-links">
            <li>Mon – Thu: 12 PM – 11 PM</li>
            <li>Fri – Sun: 12 PM – 12:30 AM</li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">Contact</div>
          <ul class="footer-links">
            <li>12-C, Gulberg III, Lahore</li>
            <li>+92 42 3587 6421</li>
            <li>reservations@saffronkitchen.pk</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">© 2026 Saffron Kitchen. All rights reserved.</div>
    </div>
  </footer>

  <script src="script.js" defer></script>
</body>
</html>`;

export const EXAMPLE_CSS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

:root {
  --color-primary: #8B4513;
  --color-primary-dark: #6B3410;
  --color-secondary: #A0785A;
  --color-accent: #D4A574;
  --color-bg: #FFF8F0;
  --color-bg-alt: #FBEEE0;
  --color-bg-dark: #2B1B10;
  --color-text: #2B1B10;
  --color-text-light: #6B5544;
  --color-text-inverse: #FFF8F0;
  --color-border: #E8D9C5;
}

body {
  font-family: 'Inter', sans-serif;
}

h1, h2, h3, h4, .nav-logo, .footer-logo {
  font-family: 'Playfair Display', serif;
}

.hero {
  background: radial-gradient(circle at 50% 0%, var(--color-bg-alt), var(--color-bg));
}

/* ===== Menu (restaurant-specific — not in the skeleton) ===== */
.menu-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  margin-bottom: var(--space-12);
}

.menu-filter-btn {
  padding: var(--space-2) var(--space-6);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-light);
  transition: all var(--transition-fast);
}

.menu-filter-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.menu-filter-btn.active {
  background: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.menu-category-tag {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent);
}

.menu-price {
  font-family: 'Playfair Display', serif;
  font-weight: 700;
  color: var(--color-primary);
  font-size: var(--text-lg);
}

.card h3 {
  margin-top: var(--space-3);
  margin-bottom: var(--space-2);
}

.card p {
  color: var(--color-text-light);
  font-size: var(--text-sm);
}

/* ===== About decorative element ===== */
.about-decor {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  position: relative;
  overflow: hidden;
}

.about-decor::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.15) 2px, transparent 2px);
  background-size: 24px 24px;
}

/* ===== Contact layout (restaurant-specific) ===== */
.contact-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: var(--space-6) 0;
}

.contact-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.contact-item strong {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-light);
}

.contact-item span {
  font-size: var(--text-base);
}

.hours-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-4);
}

.hours-table td {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
}

.hours-table td:last-child {
  text-align: right;
  font-weight: 600;
}

.contact-form {
  background: #ffffff;
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}
`;

export const EXAMPLE_JS = `document.addEventListener('DOMContentLoaded', function () {
  /* ---------- Mobile nav ---------- */
  var navToggle = document.querySelector('.nav-toggle');
  var navMobile = document.querySelector('.nav-mobile');
  var navMobileClose = document.querySelector('.nav-mobile-close');
  var navMobileLinks = navMobile ? navMobile.querySelectorAll('a') : [];

  function openMobileNav() {
    navMobile.classList.add('active');
    document.body.classList.add('nav-open');
  }
  function closeMobileNav() {
    navMobile.classList.remove('active');
    document.body.classList.remove('nav-open');
  }
  if (navToggle && navMobile) {
    navToggle.addEventListener('click', openMobileNav);
  }
  if (navMobileClose) {
    navMobileClose.addEventListener('click', closeMobileNav);
  }
  navMobileLinks.forEach(function (link) {
    link.addEventListener('click', closeMobileNav);
  });

  /* ---------- Smooth scroll ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('href');
      if (!targetId || targetId.length <= 1) return;
      var target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- Active nav link on scroll ---------- */
  var sections = document.querySelectorAll('main section[id]');
  var navLinks = document.querySelectorAll('.nav-links a, .nav-mobile a');
  var navObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var id = entry.target.getAttribute('id');
        navLinks.forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(function (section) { navObserver.observe(section); });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  var revealObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(function (el) { revealObserver.observe(el); });

  /* ---------- Stats counter ---------- */
  var statNumbers = document.querySelectorAll('.stat-number');
  var statsAnimated = false;
  function animateStats() {
    statNumbers.forEach(function (el) {
      var target = parseFloat(el.dataset.count || '0');
      var decimals = parseInt(el.dataset.decimal || '0', 10);
      var suffix = el.dataset.suffix || '';
      var duration = 1500;
      var start = performance.now();
      function tick(now) {
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = target * eased;
        el.textContent = value.toFixed(decimals) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  var statsSection = document.querySelector('.stats');
  if (statsSection) {
    var statsObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !statsAnimated) {
          statsAnimated = true;
          animateStats();
          observer.disconnect();
        }
      });
    }, { threshold: 0.4 });
    statsObserver.observe(statsSection);
  }

  /* ---------- Contact form validation ---------- */
  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      var fields = [
        { id: 'name', message: 'Please enter your name.' },
        { id: 'email', message: 'Please enter a valid email address.', pattern: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ },
        { id: 'phone', message: 'Please enter a valid phone number.', pattern: /^[0-9+\\-\\s()]{7,}$/ },
        { id: 'message', message: 'Please enter a message.' }
      ];
      fields.forEach(function (field) {
        var input = document.getElementById(field.id);
        var errorEl = form.querySelector('[data-error-for="' + field.id + '"]');
        var value = input.value.trim();
        var fieldValid = value.length > 0;
        if (fieldValid && field.pattern) fieldValid = field.pattern.test(value);
        input.classList.toggle('invalid', !fieldValid);
        if (errorEl) errorEl.textContent = fieldValid ? '' : field.message;
        if (!fieldValid) valid = false;
      });
      if (!valid) return;
      alert('Thank you! Your message has been sent — we will confirm your reservation shortly.');
      form.reset();
      form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
      form.querySelectorAll('.form-error').forEach(function (el) { el.textContent = ''; });
    });
  }

  /* ---------- Menu filter ---------- */
  var filterButtons = document.querySelectorAll('.menu-filter-btn');
  var menuCards = document.querySelectorAll('[data-category]');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var filter = btn.dataset.filter;
      menuCards.forEach(function (card) {
        var match = filter === 'all' || card.dataset.category === filter;
        if (match) {
          card.style.display = '';
          requestAnimationFrame(function () { card.classList.add('visible'); });
        } else {
          card.classList.remove('visible');
          setTimeout(function () {
            if (!card.classList.contains('visible')) card.style.display = 'none';
          }, 300);
        }
      });
    });
  });
});
`;
