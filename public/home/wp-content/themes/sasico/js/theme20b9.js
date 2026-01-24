( function( $ ) {
    'use strict';

	var sasiNavText = [
        '<i class="ss-arrow-left"></i>',
        '<i class="ss-arrow-right"></i>'
    ];

    /* rtl check */
	function rtl_owl(){
	if ($('body').hasClass("rtl")) {
		return true;
	} else {
		return false;
	}};

    /* --------------------------------------------------
    * mobile menu
    * --------------------------------------------------*/
    const baseUrl = window.location.origin + '/sasico/wp-content/themes/sasico';

	$('.mmenu_wrapper li:has(ul)').each(function () {
	if ($(this).find('.arrow').length === 0) {
		$(this).prepend('<span class="arrow"><img src="' + baseUrl + '/images/arrow-menu.svg" alt="arrow"/></span>');
	}
	});

    $(document).on('click', '.mmenu_wrapper .mobile_mainmenu > li span.arrow', function () {
		const $parent = $(this).parent();
		const $submenu = $parent.find("> ul");
		$submenu.stop(true, true).slideToggle(200);
		$(this).toggleClass("active");
	});
	
	$( "#mmenu_toggle" ).on('click', function() {
		$(this).toggleClass( "active" );
		$(this).parents('.header_mobile').toggleClass( "open" );
		$('.mobile_nav').stop(true, true).slideToggle(200);		
	});

	/* --------------------------------------------------
    * sticky container top
    * --------------------------------------------------*/
    $(window).on('load', function() {
		$('.header-desktop .sticky-header').parents('body').addClass('has-sticky');
	});
	function updateStickyCont() {
		const stickyCont = document.querySelector('.sticky-container');
		if (!stickyCont) return;
		const desktopHeader  = document.querySelector('.has-sticky .site-header');
		let navBarHeight = 0;
		
		if (window.innerWidth > 991) {
			navBarHeight = 50;
			if(desktopHeader){
				navBarHeight = 50 + desktopHeader.offsetHeight;
			}
		}
		stickyCont.style.top = navBarHeight + 'px';
	}
	window.addEventListener('load', updateStickyCont);
	window.addEventListener('resize', updateStickyCont);

	/* --------------------------------------------------
    * page header padding
    * --------------------------------------------------*/
	function updatePageHeader() {
		const pHeader = document.querySelector('.header-trans .ph-default');
		if (!pHeader) return;

		const desktopHeader  = document.querySelector('.site-header');
		const mobileHeader   = document.querySelector('.header-mobile');

		let navBarHeight = 0;

		if (window.innerWidth <= 991 && mobileHeader) {
			navBarHeight = mobileHeader.offsetHeight;
		} else if (desktopHeader) {
			navBarHeight = desktopHeader.offsetHeight;
		}

		pHeader.style.paddingTop = navBarHeight + 'px';
	}
	window.addEventListener('load', updatePageHeader);
	window.addEventListener('resize', updatePageHeader);

	$(document).ready( function() {
		/* --------------------------------------------------
	    * sticky header
	    * --------------------------------------------------*/
		$('.sticky-header').each(function(){
			var $header = $(this);
			var $clone = $('<div class="header-clone"></div>').insertAfter($header);
			$clone.height($header.outerHeight()).hide();

			$(window).on("scroll resize load", function(){
				var scrollTop = $(window).scrollTop();
				$clone.height($header.outerHeight());

				if (scrollTop > 0) {
					$header.addClass('is-stuck');
					$clone.show();
				} else {
					$header.removeClass('is-stuck');
					$clone.hide();
				}
			});
		});

		/* --------------------------------------------------
	    * related slider projects
	    * --------------------------------------------------*/
	    $('.project-related-posts').each( function () {
	        var selector = $(this);
	        selector.find('.owl-carousel').owlCarousel({
	            rtl: rtl_owl(),
	            autoplay:false,
				autoplayTimeout: 7000,
	            loop: false,
	            margin: 15,
	            navText: sasiNavText,
	            dotsClass: 'owl-dots sasi-dots-custom',
	            dots: true,
	            nav: false,
	            responsive : {
	                0 : {
			          	items: 1,
			        },
			        576 : {
			          	items: 2,
			        },
					992 : {
			          	items: 3,
			        },
					1350 : {
						margin: 30,
			        }
	            }
	        });
	    });

		/* --------------------------------------------------
	    * gallery post
	    * --------------------------------------------------*/
		$('.gallery-post').each( function () {
			var selector = $(this);
			selector.owlCarousel({
				rtl: rtl_owl(),
				loop:true,
				margin:0,
				items:1,
				dots:true,
				nav:false,
				navText: sasiNavText,
			});
		});

		/* --------------------------------------------------
	    * popup video
	    * --------------------------------------------------*/
	  	var video_popup = $('.video-popup');
	   	if (video_popup.length > 0 ) {
		   	video_popup.each( function(){
		   		var selector    = $(this),
		            videoPopup  = selector.find('.btn-play');
			   	selector.lightGallery({
				   selector: videoPopup,
			   	});
		   	});
	   	};

		/* --------------------------------------------------
		* grid lines
		* --------------------------------------------------*/
		$('.has-lines-vertical > .e-con-inner, .e-con-inner > .has-lines-vertical').prepend(`
		<div class="grid-lines grid-lines-vertical">
			<span class="g-line-vertical line-left"></span>
			<span class="g-line-vertical line2-left line2-center"></span>
			<span class="g-line-vertical line-center"></span>
			<span class="g-line-vertical line2-right line2-center"></span>
			<span class="g-line-vertical line-right"></span>
		</div>
		`);

		/* --------------------------------------------------
	    * remove bg body
	    * --------------------------------------------------*/
		$('.page-header').each(function() {
			if( $(this).hasClass('bg-active') ){
				$('body').addClass('bg-none');
			}
		});

		/* --------------------------------------------------
	    * blog-grid - only demo
	    * --------------------------------------------------*/
	    $('.post-box').each(function() {
			if ($(this).hasClass('grid-box')) {
				$(this).parent().addClass('grid');
				$(this).parents('body').addClass('bg-none');
			}
			if ($(this).hasClass('hori-box')) {
				$(this).parent().removeClass('grid');
			}
		});
	});
} )( jQuery );

