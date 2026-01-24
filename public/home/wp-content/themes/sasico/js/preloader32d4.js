( function( $ ) {
    'use strict';

    window.addEventListener("load", function() {
        const preloader = document.getElementById("preloader");
        setTimeout(() => {
        preloader.classList.add("hidden");
        setTimeout(() => preloader.remove(), 800);
        }, 200); 
    });

} )( jQuery );