document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const menuWrapper = document.getElementById('menuWrapper');
    // Перевірка наявності елементів
    if (menuBtn && menuWrapper) {
        menuBtn.addEventListener('click', () => {
            menuWrapper.classList.toggle('open');
        });
    } else {
        console.error('Елементи меню не знайдені');
    }
});
