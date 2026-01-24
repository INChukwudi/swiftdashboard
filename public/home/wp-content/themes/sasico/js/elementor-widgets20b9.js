( function( $ ) {
    'use strict';

    /* rtl for Owl Carousel */
    function rtl_owl(){
    if ($('body').hasClass("rtl")) {
        return true;
    } else {
        return false;
    }};

    /* rtl for Isotop */
    function rtl_isotop(){
        if ($('body').hasClass("rtl")) {
            return false;
        } else {
            return true;
        }
    };

    /* OT Custom Nav Arrow Slider */
    var sasiNavText = [
        '<i class="ss-arrow-left"></i>',
        '<i class="ss-arrow-right"></i>'
    ];

    /* --------------------------------------------------
    * Accordions
    * --------------------------------------------------*/
    var sasiAccordions = function ($scope, $) {
        $scope.find('.sasi-accordions-wrapper').each( function () {
            var selector = $(this),
                content = selector.find('.sasi-acc-item__content'),
                header  = selector.find('.sasi-acc-item__title');

            header.off("click");

            header.each(function(){
                if ($(this).data('default') == 'yes') {
                    $(this).next().addClass('active').slideDown(200);
                    $(this).parent().addClass('current');
                }
            });

            header.on('click', function(e){
                e.preventDefault();
                var $this = $(this);

                $this.next().toggleClass('active').slideToggle(200);
                $this.parent().toggleClass('current');
                if( !selector.hasClass('multi-expand') ){
                    content.not($this.next()).slideUp(200);
                    header.not($this).parent().removeClass('current');
                }
            });
        });
    };
    /* --------------------------------------------------
    * Showcase
    * --------------------------------------------------*/
    var sasiShowcase = function ($scope, $) {
        $scope.find('.sasi-showcase-wrapper').each( function () {
            var selector = $(this),
                item     = selector.find('.sasi-showcase__item');

            /* Active item first after load*/
            var firstItem = item.first(),
                firstContent = firstItem.find('.sasi-showcase__content-wrapper');
            firstItem.addClass('active');
            firstContent.css('height', firstContent[0].scrollHeight + 'px');

            item.on('click', function() {
                var $this = $(this);

                if ($this.hasClass('active')) return;

                /*Close item old*/
                var activeItem = item.filter('.active');
                var activeContent = activeItem.find('.sasi-showcase__content-wrapper');
                activeContent.css('height', 0);
                activeItem.removeClass('active');

                /*Open item new*/
                var content = $this.find('.sasi-showcase__content-wrapper');
                $this.addClass('active');
                content.css('height', content[0].scrollHeight + 'px');
            });

            var resizeTimer;
            $(window).on('resize', function() {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function() {
                    var activeItem = item.filter('.active');
                    if (activeItem.length) {
                        var activeContent = activeItem.find('.sasi-showcase__content-wrapper');
                        activeContent.css('height', activeContent[0].scrollHeight + 'px');
                    }
                }, 50); // nhỏ để hạn chế giật khi resize liên tục
            });
        });
    };

    function sasiGenericTabs($scope, $, wrapperSelector, tabSelector) {
        $scope.find(wrapperSelector).each(function () {
            var container = $(this),
                tabs = container.find(tabSelector),
                firstTab = tabs.first();

            var tabMap = {};

            /* Store each tab's content element and hide it */
            tabs.each(function () {
                var tabId = $(this).attr('data-tab');
                tabMap[tabId] = $('#' + tabId);
                tabMap[tabId].hide();
            });

            /* Activate the first tab */
            firstTab.addClass('current');
            tabMap[firstTab.attr('data-tab')].show();

            /* Handle tab click events */
            tabs.on('click', function (e) {
                e.preventDefault();
                var clicked = $(this);
                if (clicked.hasClass('current')) return;

                tabs.removeClass('current');

                /* Hide all tab content */
                $.each(tabMap, function (_, content) {
                    content.hide();
                });

                /* Show the clicked tab content */
                clicked.addClass('current');
                tabMap[clicked.attr('data-tab')].fadeIn(300);
            });
        });
    }

    /* --------------------------------------------------
    * Pricing Tabs
    * --------------------------------------------------*/
    var sasiPricingTabs = function ($scope, $) {
        sasiGenericTabs($scope, $, '.sasi-pricing-tabs', '.sasi-pricing-tabs__item');
    }
    
    /* --------------------------------------------------
    * Button Tabs
    * --------------------------------------------------*/
    var sasiButtonTabs = function ($scope, $) {
        sasiGenericTabs($scope, $, '.sasi-btn-tabs', '.sasi-btn');
    }

    /**
    * Pricing Switcher
    * Enables monthly/yearly switcher seen on pricing tables
    */
    var sasiSwitcher = function ($scope, $) {
        $scope.find('.sasi-switchs-wrap').each( function () {
            var selector    = $(this),
                switcher   = selector.find('.sasi-switch');

            switcher.on( 'click', function(e){
                e.preventDefault();

                var clicked = $(this);
                if( clicked.hasClass('sasi-switch-active') ) return false;

                switcher.removeClass('sasi-switch-active');
                clicked.addClass('sasi-switch-active');
                selector.toggleClass('switched');

                var targetId = clicked.data('id'),
                    targetContent = $('#' + targetId);

                /* Hide all related content blocks */
                switcher.each(function () {
                    var contentId = $(this).data('id');
                    $('#' + contentId).stop(true, true).hide();
                });
                /* Show the content corresponding to the active switch */
                if (targetContent.length) {
                    targetContent.stop(true, true).show();
                }
            });

            /* Trigger the first switch by default */
            switcher.first().trigger('click');
        });
    }

    /* --------------------------------------------------
     * Progress bar
     * --------------------------------------------------*/
    function lineProgress() {
        $('.sasi-progress-line:not([data-processed])').each(function() {
            var bar = $(this),
                line = bar.find(".sasi-progress-bar"),
                progressEnd = bar.data('percent'),
                percent = bar.find('.sasi-progress-percent');
            var scrollTop = $(document).scrollTop() + $(window).height();

            if ( scrollTop >  bar.offset().top +  bar.height() ) {
                bar.attr("data-processed", "true");
                line.css("width", (bar.outerWidth() * (progressEnd / 100)) + "px");

                for (var i = 0; i <= 50; i++) {
                    (function (count) {
                        setTimeout(function () {
                            percent.html(Math.round((progressEnd / 50) * count) + "%");
                        }, 30 * count);
                    })(i);
                }
            }
        });
    };

    /* Progress bar size */
    function lineProgressSize() {
        $('.sasi-progress-line[data-processed]').each(function () {
            var bar = $(this);
            var line = bar.find(".sasi-progress-bar");
            var progressEnd = parseInt(bar.data('percent'));

            line.css("width", (bar.outerWidth() * (progressEnd / 100)) + "px");
        });
    }

    /* ------------------------------------------
     * Circle Progress
     * ----------------------------------------*/

    function circleProgress() {
        $('.sasi-progress-circle:not([data-processed])').each(function() {
            var circle    = $(this),
                bar_color = circle.data('color'),
                bar_hei   = circle.data('height'),
                bar_size  = circle.data('size');
            var scrollTop = $(document).scrollTop() + $(window).height();
            if ( scrollTop >  circle.offset().top +  circle.height() ) {
                circle.attr("data-processed", "true");
                circle.find('.sasi-progress-circle__inner').easyPieChart({
                    barColor: bar_color,
                    trackColor: false,
                    scaleColor: false,
                    lineCap: 'round',
                    lineWidth: bar_hei,
                    size: bar_size,
                    rotate: 90,
                    animate: 1000,
                    onStart: $.noop,
                    onStop: $.noop,
                    onStep: function(from, to, percent) {
                        $(this.el).find('.sasi-progress-percent').html(Math.round(percent) + '<span class="sasi-progress-unit">%</span>');
                    }
                });
            }
        });
    };
    
    var sasiProgressBar = function () {
        lineProgress();
        circleProgress();
    };

    /* --------------------------------------------------
     * Process Grid calculator height description
     * --------------------------------------------------*/

    function processDescMaxHeight(){
        var wraper = $('.sasi-process-box-grid');
        if(wraper.length){
            wraper.each(function () {
                var item = $(this).find('.sasi-process-box__item');
                item.each(function () {
                    var desc = $(this).find('.sasi-process-box__desc');
                    if (desc.length) {
                        var heightDesc = desc[0].scrollHeight;
                        desc.css( "--desc-max-height", heightDesc + "px" );
                    }
                });
            });
        } 
    }

	/* --------------------------------------------------
     * Client Logo Carousel
     * --------------------------------------------------*/
    var clientLogoCarousel = function ($scope, $) {
        $scope.find('.sasi-image-carousel').each( function () {
            var selector     = $(this),
                sliderSettings = selector.data('slider_options'),
                dotsClass = sliderSettings.dots_style === 'classic' ? 'owl-dots sasi-dots-classic' : 'owl-dots sasi-dots-custom';
                
            selector.find('.owl-carousel').owlCarousel({
                rtl: rtl_owl(),
                autoplay: 'yes' === sliderSettings.autoplay,
                autoplayTimeout: parseInt(sliderSettings.autoplay_time_out),
                loop: 'yes' === sliderSettings.loop,
                responsiveClass:true,
                dotsClass: String(dotsClass),
                dots: sliderSettings.dots,
                nav: sliderSettings.arrows,
                autoplayHoverPause: true,
                navText: sasiNavText,
                responsive : {
                    0 : {
                        items: parseInt(sliderSettings.slides_show_mobile),
                        margin: parseInt(sliderSettings.margin_mobile),
                    },
                    576 : {
                        items: parseInt(sliderSettings.slides_show_mobile_extra),
                        margin: parseInt(sliderSettings.margin_mobile_extra),
                    },
                    768 : {
                        items: parseInt(sliderSettings.slides_show_tablet),
                        margin: parseInt(sliderSettings.margin_tablet),
                    },
                    992 : {
                        items: parseInt(sliderSettings.slides_show_tablet_extra),
                        margin: parseInt(sliderSettings.margin_tablet_extra),
                    },
                    1200 : {
                        items: parseInt(sliderSettings.slides_show_laptop),
                        margin: parseInt(sliderSettings.margin_laptop),
                    },
                    1400 : {
                        items: parseInt(sliderSettings.slides_show_desktop),
                        margin: parseInt(sliderSettings.margin_desktop),
                    }
                },
                onInitialized: function(event) {
                    addDotsLabel(event);
                },
                onChanged: function(event) {
                    addDotsLabel(event);
                }
            });
            
        });
    };

    /* --------------------------------------------------
     * Testimonial Slider
     * --------------------------------------------------*/
    var testimonialSlider = function ($scope, $) {
        $scope.find('.sasi-testimonial-carousel').each( function () {
            
            var selector     = $(this),
                sliderSettings = selector.data('slider_options'),
                dotsClass = sliderSettings.dots_style === 'classic' ? 'owl-dots sasi-dots-classic' : 'owl-dots sasi-dots-custom';
                
            selector.find('.owl-carousel').owlCarousel({
                rtl: rtl_owl(),
                autoplay: 'yes' === sliderSettings.autoplay,
                autoplayTimeout: parseInt(sliderSettings.autoplay_time_out),
                loop: 'yes' === sliderSettings.loop,
                animateOut: 'yes' === sliderSettings.fade ? 'fadeOut' : '',
                responsiveClass:true,
                dotsClass: String(dotsClass),
                dots: sliderSettings.dots,
                nav: sliderSettings.arrows,
                navText: sasiNavText,
                autoplayHoverPause: true,
                smartSpeed: 500,
                dotsSpeed: 350,
                responsive : {
                    0 : {
                        items: parseInt(sliderSettings.slides_show_mobile),
                        margin: parseInt(sliderSettings.margin_mobile),
                    },
                    576 : {
                        items: parseInt(sliderSettings.slides_show_mobile_extra),
                        margin: parseInt(sliderSettings.margin_mobile_extra),
                    },
                    768 : {
                        items: parseInt(sliderSettings.slides_show_tablet),
                        margin: parseInt(sliderSettings.margin_tablet),
                    },
                    992 : {
                        items: parseInt(sliderSettings.slides_show_tablet_extra),
                        margin: parseInt(sliderSettings.margin_tablet_extra),
                    },
                    1200 : {
                        items: parseInt(sliderSettings.slides_show_laptop),
                        margin: parseInt(sliderSettings.margin_laptop),
                    },
                    1400 : {
                        items: parseInt(sliderSettings.slides_show_desktop),
                        margin: parseInt(sliderSettings.margin_desktop),
                    }
                },
                onInitialized: function(event) {
                    addDotsLabel(event);
                },
                onChanged: function(event) {
                    addDotsLabel(event);
                }
            });
        });
    };

    /* --------------------------------------------------
     * Testimonial Avatar Custom Dots
     * --------------------------------------------------*/
    var testimonialSlider2 = function ($scope, $) {
        $scope.find('.sasi-testimonial-single-carousel').each( function () {
            
            var selector       = $(this),
                slider         = selector.find('.owl-carousel'),
                dotsItem       = selector.find('.avatar-custom-dots .avatar-dot-item'),
                sliderSettings = selector.data('slider_options');
                
            slider.owlCarousel({
                rtl: rtl_owl(),
                autoplay: 'yes' === sliderSettings.autoplay,
                autoplayTimeout: parseInt(sliderSettings.autoplay_time_out),
                loop: 'yes' === sliderSettings.loop,
                animateOut: 'yes' === sliderSettings.fade ? 'fadeOut' : '',
                responsiveClass:true,
                dots: sliderSettings.dots,
                nav: 'yes' === sliderSettings.arrows,
                navText: sasiNavText,
                autoplayHoverPause: true,
                smartSpeed: 500,
                dotsSpeed: 350,
                responsive : {
                    0 : {
                        items: parseInt(sliderSettings.slides_show_mobile),
                        margin: parseInt(sliderSettings.margin_mobile),
                    },
                    576 : {
                        items: parseInt(sliderSettings.slides_show_mobile_extra),
                        margin: parseInt(sliderSettings.margin_mobile_extra),
                    },
                    768 : {
                        items: parseInt(sliderSettings.slides_show_tablet),
                        margin: parseInt(sliderSettings.margin_tablet),
                    },
                    992 : {
                        items: parseInt(sliderSettings.slides_show_tablet_extra),
                        margin: parseInt(sliderSettings.margin_tablet_extra),
                    },
                    1200 : {
                        items: parseInt(sliderSettings.slides_show_laptop),
                        margin: parseInt(sliderSettings.margin_laptop),
                    },
                    1400 : {
                        items: parseInt(sliderSettings.slides_show_desktop),
                        margin: parseInt(sliderSettings.margin_desktop),
                    }
                },
                onInitialized: function(event) {
                    addDotsLabel(event);
                    dotsItem.removeClass("active").eq(0).addClass("active");
                },
                onChanged: function(event) {
                    addDotsLabel(event);
                }
            });
            /* when click avatar */
            dotsItem.on("click", function(){
                var index = $(this).data("slide");
                slider.trigger("to.owl.carousel", [index, 300]);
            });

            /* Sync avatar when carousel change */
            slider.on("changed.owl.carousel", function(event) {
                var index = event.item.index - event.relatedTarget._clones.length / 2;
                var count = event.item.count;
                if (index < 0) index = count - 1;
                if (index >= count) index = 0;

                dotsItem.removeClass("active").eq(index).addClass("active");
            });

        });
    };
    /* --------------------------------------------------
    * Add dots label slider
    * --------------------------------------------------*/

    function addDotsLabel(event) {
        var dots = $(event.target).find('.owl-dot');
        if (dots.length) {
            dots.each(function(index) {
                $(this).attr('aria-label', 'Slide ' + (index + 1));
            });
        }
    }

    /* --------------------------------------------------
    * Portfolio filter isotope
    * --------------------------------------------------*/

    function sasiIsotope() {
        $('.projects-masonry').each(function () {
            var $isotopeWrap = $(this),
                layoutMode   = $isotopeWrap.data('layout') ? $isotopeWrap.data('layout') : 'fitRows';
            var properties = {
                itemSelector : '.project-item',
                animationEngine : 'css',
                layoutMode: layoutMode,
                percentPosition: true,
                masonry: {
                    columnWidth: '.grid-sizer'
                },
                isOriginLeft: rtl_isotop(),
                transitionDuration: '0.5s'
            };
            $isotopeWrap.imagesLoaded(function() {
                $isotopeWrap.isotope(properties);
                $isotopeWrap.isotope("layout");
            });
            sasiIsotopeFilterHandler(this);
            sasiLightGallery(this);
        });
    }

    function sasiIsotopeFilterHandler(self){
        var filterBtn = $(self).closest('.projects-filter-wrapper').find('.isotope-filter .filter-item');

        /* Filter Handler */
        filterBtn.on('click', function (e) {
            e.preventDefault();

            var $this = $(this);
            if ( $this.hasClass('active') ) {
                return;
            }
            $this.addClass('active').parent().siblings().find('a').removeClass('active');

            var dataFilter  = $this.attr('data-filter'),
                isotopeWrap = $this.closest('.projects-filter-wrapper').find('.projects-masonry');
            isotopeWrap.isotope({ 
                filter: dataFilter 
            });
        });
    }
    function sasiLightGallery(self) {
        if( $(self).hasClass('image-popup-gallery') ){
            $(self).lightGallery({
                selector: '.image-popup-gallery .projects-thumbnail',
                share: false,
                pager: false,
                thumbnail: false,
            }); 
        }
    }

    /* --------------------------------------------------
    * Countdown for coming soon
    * --------------------------------------------------*/
    var sasiCountDown = function($scope, $){
        $scope.find('.sasi-countdown').each( function(){
            var selector = $(this),
                date     = selector.data('date'),
                zone     = selector.data('zone'),
                day      = selector.data('day'),
                days     = selector.data('days'),
                hour     = selector.data('hour'),
                hours    = selector.data('hours'),
                min      = selector.data('min'),
                mins     = selector.data('mins'),
                second   = selector.data('second'),
                seconds  = selector.data('seconds');
            selector.countdown({
                date: date,
                offset: zone,
                day: day,
                days: days,
                hour: hour,
                hours: hours,
                minute: min,
                minutes: mins,
                second: second,
                seconds: seconds
            }, function () {
                alert('Done!');
            });
        });
    };
    
    /* --------------------------------------------------
    * Process Box
    * --------------------------------------------------*/

    function processBox() {
        $('.sasi-process').each(function() {
            const $container = $(this);
            $container.find('.sasi-process-item').on('click', function() {
                $('.sasi-process-item').removeClass('step-open');

                $(this).addClass('step-open');
            });
        });
    }

    /* --------------------------------------------------
    * handle after scroll/load/resize
    * --------------------------------------------------*/
    $(window).on('scroll', function() {
        lineProgress();
        circleProgress();
        
    });
    $(window).on('load', function () {
        lineProgress();
        circleProgress();
        sasiIsotope();
        processDescMaxHeight();
        
    });
    $(window).on('resize', function () {
        lineProgressSize();
        processDescMaxHeight();
    });

    /**
     * Elementor JS Hooks
     */
    $(window).on("elementor/frontend/init", function () {

        if ( window.elementorFrontend.isEditMode() ) {
            /* Portfolio filter isotop */
            window.elementorFrontend.hooks.addAction(
                "frontend/element_ready/sasi-portfolio-filter.default",
                function () {
                    sasiIsotope();
                }
            );
        }

        /* Progress bar */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-progress.default",
            sasiProgressBar
        );
        /* Process Box */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-process-box.default",
            processBox
        );

    	/* Logo Slider */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-image-slider.default",
            clientLogoCarousel
        );
        /* Testimonial Carousel */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel.default",
            testimonialSlider
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel_2.default",
            testimonialSlider
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel_3.default",
            testimonialSlider
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel_4.default",
            testimonialSlider2
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel_5.default",
            testimonialSlider
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel_6.default",
            testimonialSlider
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-testimonials-carousel_7.default",
            testimonialSlider
        );
        /* Accordions */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-accordions.default",
            sasiAccordions
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-accordions-2.default",
            sasiAccordions
        );
        /* Showcase */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-showcase.default",
            sasiShowcase
        );
        /* Custom tabs */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-pricing-tabs.default",
            sasiPricingTabs
        );
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-button-tabs.default",
            sasiButtonTabs
        );
        /* Switchs */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-switchs.default",
            sasiSwitcher
        );
        /* Countdown */
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasi-countdown.default",
            sasiCountDown
        );
    });

} )( jQuery );