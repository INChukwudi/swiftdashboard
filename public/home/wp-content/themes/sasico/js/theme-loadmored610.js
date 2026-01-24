(function($) {
	"use strict";

	$(document).ready(function() {
        sasiAjaxLoad();
    });

    function sasiAjaxLoad() {

        var i, section;
        var sections = document.getElementsByClassName('projects-filter-wrapper');
        for (i = 0; i < sections.length; i++) {
            section = sections[i];
            var load_more = section.getElementsByClassName('btn-loadmore');
            if (load_more.length) {
                sasiAjaxInit(section);
            }
        }
    }
    
    var	offset_items = 0;

    function sasiAjaxQuery(grid, section, request_data) {

    	offset_items = grid.getElementsByClassName('project-item').length;
		request_data['offset_items'] = offset_items ? offset_items : 0;

		
        $.ajax({
			url : sasico_loadmore_params.ajaxurl, /*AJAX handler*/
			data : request_data,
			type : 'POST',
			beforeSend : function ( xhr ) { 
				/* $(section).find('.loadmore_wrapper .btn-loadmore').append('<i class=" uil-sync" aria-hidden="true"></i>'); some type of preloader */
			},
			success : function( response ){
				var resp, new_items, load_more_hidden;
				resp = document.createElement('div');
                resp.innerHTML = response;
                new_items = $('.project-item', resp);
                load_more_hidden = $('.hidden_load_more', resp);
				/*console.log(new_items);*/
				if(load_more_hidden.length){
                    $(section)
                        .find('.loadmore_wrapper')
                        .fadeOut(1200, function() {
                            $(this).remove();
                        });
                }else{
                    $(section)
                        .find('.loadmore_wrapper .btn-loadmore')
                        .removeClass('loading');
                }
				if( new_items.length ) {
					var items = $(new_items);
					$(grid).imagesLoaded().always(function() {
						$(grid).append(items).isotope('appended', items).isotope('reloadItems'); /*insert new posts*/
						setTimeout(function() {
							$(grid).isotope('layout');
							$(grid).isotope({ sortBy : 'original-order' });
						}, 400);
                        /* Popup Light Gallery */
                        if( $(grid).hasClass('image-popup-gallery') ){
                            $(grid).find('.project-item').each(function () {
                                $(this).find('.projects-thumbnail > a').removeAttr("href");
                            });
                            $(grid).data("lightGallery").destroy(true);
                            $(grid).lightGallery({
                                selector: '.image-popup-gallery .projects-thumbnail',
                                share: false,
                                pager: false,
                                thumbnail: false
                            });
                        }
					});
				}
			}
		});
    }

    function sasiAjaxInit(section) {

        var grid, btn_loadmore, form_data, field_data, data, request_data;
        if (section == undefined) {
            return;
        }

        /* Get projects masonry */
        grid = section.getElementsByClassName('projects-masonry');
        if (!grid.length) { return; }
        grid = grid[0];

        /*Get form data*/
        form_data = section.getElementsByClassName('posts_data_ajax');
        if (!form_data.length) { return; }
        form_data = form_data[0];

        /*Get field data*/
        field_data = form_data.getElementsByClassName('data_ajax');
        if (!field_data.length) { return; }
        field_data = field_data[0];

        /* Get param loadmore */
        data = field_data.value;
        request_data = JSON.parse(data);
        request_data['action'] = 'loadmore';

        /* Get btn loadmore */
        btn_loadmore = section.getElementsByClassName('btn-loadmore');
        if (!btn_loadmore.length) { return; }
        btn_loadmore = btn_loadmore[0];

        btn_loadmore.addEventListener( 'click',
            function(e) {
                e.preventDefault();
                $(this).addClass('loading');
                sasiAjaxQuery(grid, section, request_data);
            },
            false
        );
        
    }

	/**
     * Elementor JS Hooks
     */
    $(window).on("elementor/frontend/init", function () {
    	if ( window.elementorFrontend.isEditMode() ) {
    		/* Portfolio filter isotop */
            window.elementorFrontend.hooks.addAction(
                "frontend/element_ready/sasi-portfolio-filter.default",
                function () {
                    sasiAjaxLoad();
                }
            );
    	}
  	});

})(jQuery);