(function($) {
    "use strict";
  
    /* --------------------------------------------------
    * side panel
    * --------------------------------------------------*/
    var element = $('a[href="#side-panel"]'),
        sidebar = $('#side-panel');

    function panel_handler() {
        var isActive = !element.hasClass('active');

        element.toggleClass('active', isActive);
        sidebar.toggleClass('side-panel-open', isActive);
        $('body').toggleClass('side-panel-active', isActive);
        return false;
    }

    $('a[href="#side-panel"], .side-panel-close, .panel-overlay').on('click', panel_handler);
  
    /* --------------------------------------------------
    * toggle search
    * --------------------------------------------------*/

    var tgSearch = function ($scope, $) {
    $scope.find('.sasi-search').each(function () {
        var $container = $(this),
            $toggle    = $container.find('.toggle-search'),
            $overlay   = $container.find('.search-overlay'),
            $formInner = $container.find('.sasi-form-inner'),
            $input     = $container.find('.search-field');

            function toggleSearch(e) {
                e.preventDefault();

                var isActive = !$toggle.hasClass('active');
                $toggle.toggleClass('active', isActive);
                $overlay.toggleClass('search-open', isActive);
                $('body').toggleClass('search-active', isActive);
                if(isActive){
                    setTimeout(function () {
                    $input.trigger('focus');
                    }, 300); 
                }
            }

            $formInner.on('click', function (e) {
                e.stopPropagation();
            });

            $toggle.on('click', toggleSearch);
            $overlay.on('click', toggleSearch);
        });
    };

  
    /* --------------------------------------------------
    * mobile menu
    * --------------------------------------------------*/
    var mmenuPanel  = function(){
      var element = $('#mmenu-toggle'),
          mmenu   = $('#mmenu-wrapper');

      function mmenu_handler() {
          var isActive = !element.hasClass('active');

          element.toggleClass('active', isActive);
          mmenu.toggleClass('mmenu-open', isActive);
          $('body').toggleClass('mmenu-active', isActive);
          return false;
      }

      $('#mmenu-toggle, .mmenu-close, .mmenu-overlay').on('click', mmenu_handler);

      $('.mmenu-wrapper li:has(ul) > a').append('<span class="arrow"><i class="ss-angle-down"></i></span>');
      $('.mmenu-wrapper li:has(ul) > a').on('click',function() {
          $(this).next('ul').stop(true, true).slideToggle()
          $(this).toggleClass( "active" ); 
          return false;
      });

    };
  
    /**
     * Elementor JS Hooks
     */
    $(window).on("elementor/frontend/init", function () {

        /*toggle search*/
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasico-search.default",
            tgSearch
        );

        /*mmenu*/
        elementorFrontend.hooks.addAction(
            "frontend/element_ready/sasico-menu-mobile.default",
            mmenuPanel
        );
  
    });
  
  })(jQuery);