document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const authModal = document.getElementById('auth-modal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const switchToSignup = document.getElementById('switchToSignup');
  const switchToLogin = document.getElementById('switchToLogin');

  const loginButtons = [
    document.getElementById('navLoginBtn'),
    document.getElementById('mobileLoginBtn'),
    document.getElementById('heroLoginBtn')
  ];

  const signupButtons = [
    document.getElementById('heroSignupBtn'),
    document.getElementById('ctaSignupBtn')
  ];

  mobileMenuBtn.addEventListener('click', function() {
    mobileMenu.classList.toggle('active');
  });

  loginButtons.forEach(button => {
    if (button) {
      button.addEventListener('click', function() {
        authModal.classList.add('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        mobileMenu.classList.remove('active');
      });
    }
  });

  signupButtons.forEach(button => {
    if (button) {
      button.addEventListener('click', function() {
        authModal.classList.add('active');
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        mobileMenu.classList.remove('active');
      });
    }
  });

  modalOverlay.addEventListener('click', function() {
    authModal.classList.remove('active');
  });

  modalClose.addEventListener('click', function() {
    authModal.classList.remove('active');
  });

  switchToSignup.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  });

  switchToLogin.addEventListener('click', function(e) {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      mobileMenu.classList.remove('active');
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});
