//Javascript functions for PyStump

//provided by libraries
/* global $, jQuery, CKEDITOR, Mustache */

//provided by the header
/* global Transition_Time, Show_Updated, Show_Author, transition_backend */

/////////////////////////////////////
// Utilities and jQuery extensions //
/////////////////////////////////////


//Case-insensitve :contains operator for jQuery selectors

$.extend($.expr[':'], {
    'containsi': function(elem, i, match, array)
    {
    return ((elem.textContent || elem.innerText || '') + (elem.title || '')).toLowerCase()
        .indexOf((match[3] || "").toLowerCase()) >= 0;
    }
});

//Animate.css wrapper function (adapted from animate.css README)

$.fn.extend({
    animateCss: function (animationName, animation_duration) {
    var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
    if (animation_duration){
        var dv = animation_duration + 'ms';
        var duration_props = {
        '-webkit-animation-duration': dv,
        '-moz-animation-duration': dv,
        '-o-animation-duration': dv,
        'animation-duration': dv
        };
        $(this).css(duration_props);
    }
    $(this).addClass('animated ' + animationName).one(animationEnd, function() {
        $(this).removeClass('animated ' + animationName);
        $(this).trigger("animatecss.finished");
    });
    }
});

// This function takes an element and stretches it to fit the parent element, expanding text to maximum size.
function fit_el_to_parent(el, parent, height_adjust) {
    parent = parent || el.parentElement;
    height_adjust = height_adjust || 0;
    var $el = $(el);
    var target_height =  (parent.innerHeight || parent.scrollHeight) - height_adjust;
    var numbreaks = $el.find("br, p").size() +1;
    var target_width = parent.innerWidth || parent.scrollWidth;
    var line_size = target_height / numbreaks;
    var font_size = line_size;

    $el.css({
    "white-space": "nowrap",
    "font-size": font_size+"px",
    'position': 'absolute',
    'top': 0,
    'padding': 0,
    'margin': 0
    });
    //The basic concept here is to shrink the text by 10% until the scrollwidth is less than the target width, and scrollheight likewise.
    //This would indicate a lack of scrollbars.
    while ((el.scrollWidth > target_width || el.scrollHeight > target_height) && font_size > 12){
    font_size *= .9;
    $el.css("font-size", font_size+"px");
    //console.log($(el).attr("id"), "W: ", $(el)[0].scrollWidth, target_width,"; H:",  $(el)[0].scrollHeight, target_height, '; F: ', font_size );
    }
    $el.width("100%");
    $el.height("100%");
}

// shortcut to disable or enable form elements
$.fn.extend({
    set_enabled: function(enable){
    if (enable){
        $(this).removeAttr("disabled");
    }else{
        $(this).attr("disabled", "disabled");
    }
    }
});


//evaluate variables in the slide content
function slide_content_eval(content){

    var variables = {};
    var d = new Date();

    variables['date'] = d.toLocaleDateString();
    variables['time'] = d.toLocaleTimeString(navigator.language, {hour: '2-digit', minute: '2-digit'});

    return Mustache.render(content, variables);

}

////////////////
// Components //
////////////////

var BackgroundImageControl = function($el){
    if ($el.length === 0){
    return null;
    }

    $el.preview = $el.find("DIV.preview_popup");

    $el.on("mouseenter", function(){
    $el.preview.show();
    });

    $el.on("mouseleave", function(){
    $el.preview.hide();
    });

    return $el;
};

var FormDialog = function(url, init_function, submit_function){
    // A popup dialog containing a form.

    var fd = {};

    fd.url = document.basepath.replace(/\/$/, '') + url;

    fd.dialog_options = {
    width: "90%",
    modal: true
    };
    fd.$dialog = $("#_dialog_");
    fd.$dialog.hide();

    fd.showform  = function(url_suffix){
    var url = url_suffix ? fd.url + url_suffix : fd.url;

    $.get(url, function(data){
        fd.dialog_options.title = $(data).attr("title");
        fd.$dialog.html(data).dialog(fd.dialog_options);
        fd.$form = fd.$dialog.find("FORM");

        //common form initialization

        //Datetime inputs.
        var date_display_fmt = "m/d/yy";
        var time_display_fmt = "h:mm tt";

        fd.$form.find(":input.datepicker").each(
        function(i, el){
            var $input = $(el);
            var widget = $input.data("widget") + "picker";
            var altfield_id = $input.data("altfield");
            var dateval = $input.val()? new Date($input.val()) : null;

            $input[widget]({
            altField: "#" + altfield_id,
            altFormat: "yy-mm-dd",
            altTimeFormat: "HH:mm:ssz",
            altSeparator: "T",
            altFieldTimeOnly: false,
            timeFormat: time_display_fmt,
            dateFormat: date_display_fmt,
            constrainInput: true,
            showSecond: false,
            showTimezone: false
            //parse: 'loose'
            });

            $input[widget]('setDate', dateval);

            //datetimepicker doesn't automatically clear the altField when its field is cleared.

            $input.on("change", function(){
            if ($input.val().trim() === ''){
                $("#" + altfield_id).val('');
            }
            });
        });

        //image preview
        fd.bg_image_control = BackgroundImageControl(
        fd.$form.find("#bg_image_control")
        );

        // Textareas to CKEDITOR
        $("TEXTAREA.ckedit").ckeditor({customConfig: '../js/editor_config.js', height: '20em'});

        //custom init function

        if (init_function){
        init_function(fd.$form);
        }

        //submit function

        if (submit_function){
        fd.$form.on("submit", function(e){
            submit_function(e, fd.$form);
        });
        }
    });
    };//end show_form()

    return fd;
};


var AnnouncementList = function(el, search_el){
    var $al = $(el);
    $al.searchbox = $(search_el);

    if ($al.length === 0){
    return null;
    }

    $al.items = $al.find(".announcement_item");
    $al.edit_buttons = $al.find("BUTTON.edit");
    $al.preview_buttons = $al.find("BUTTON.preview");

    $al.searchbox.focus();

    $al.searchbox.keyup(function(){
    var term = $al.searchbox.val();
    if (term.length > 0){
        $al.items.hide();
        $al.items.filter(":containsi(" + term + ")").show();
    }else{
        $al.items.show();
    }
    });

    $al.edit_buttons.on("click", function(e){
    e.preventDefault();
    var id = $(this).closest("li").data("id");
    document.edit_form.showform("/" + id);
    return false;
    });

    $al.preview_buttons.on("click", function(e){
    e.preventDefault();
    var id = $(this).closest("li").data("id");
    window.open(document.basepath.replace(/\/$/, '') + "/preview/" + id);
    return false;
    });

    return $al;
};


var AnnouncementDisplay = function(el, autoadvance){
    var $ad = $(el);
    if ($ad.length === 0){
        $("#back_slide").set_enabled(false);
        $("#advance_slide").set_enabled(false);
        return null;
    }else{
        $("#back_slide").set_enabled(true);
        $("#advance_slide").set_enabled(true);
    }

    $ad.init = function(){
        $ad.slides = $ad.find(".announcement_display");
        $ad.slides.each(function(i, el){
            fit_el_to_parent(el, window, $("NAV").outerHeight() + $("#meta").outerHeight());
        });
        $ad.old_slide = $ad.slides.length > 1 ? $ad.slides.last() : null;
        $ad.slides.hide();
        if ($ad.old_slide){
            $ad.old_slide.html(slide_content_eval($ad.old_slide.html()));
            $ad.old_slide.show();
        }
        $ad.slide = $ad.slides.first();
        if ($ad.slide.length > 0){
            $ad.show_slide();
        }
    };

    $ad.refresh_slides = function(){
    $.get(
        document.basepath.replace(/\/$/, '') + "/slides",
        function(data){
            $ad.html(data);
            $ad.init();
        }).fail(function(){
            window.setTimeout($ad.refresh_slides, 10000);
        });
    };

    $ad.show_slide = function(){
        var duration = parseInt($ad.slide.data("duration"), 10) * 1000;
        var transition = $ad.slide.data("transition");
        var transition_time = parseInt(Transition_Time, 10) || 500; // milliseconds

        //set title
        $("#title").html($ad.slide.data("title"));
        //set meta info
        var meta_text = (Show_Updated ? ("Updated " + $ad.slide.data("updated") + ' ') : ' ') +
            (Show_Author ? ("By " + $ad.slide.data("author")) : '');
        $("#meta").html(meta_text);

        //process variables in the slide content
        $ad.slide.html(slide_content_eval($ad.slide.html()));

        //hide the slides and show the new one.
        //$ad.slides.hide();
        if ($ad.old_slide){
            $ad.old_slide.css({'z-index': 0});
        }

        $ad.slide.css({'z-index': 100, 'top': 0});
        if (transition && transition_backend === 'animatecss'){
            $ad.slide.show();
            $ad.slide.animateCss(transition, transition_time);
            $ad.slide.one('animatecss.finished', function(){
            $ad.old_slide.hide();
            });
        }else if (transition && transition_backend === 'jquery-ui'){
            $ad.slide.show({
                effect: transition,
                duration: transition_time,
                complete: function(){ $ad.old_slide.hide(); }
            });
        }else{
            $ad.slide.show();
            $ad.old_slide.hide();
        }

    //set the timer for moving to the next slide
    if (autoadvance) {
        if ($ad.advance_timeout){
        window.clearTimeout($ad.advance_timeout);
        }
        $ad.advance_timeout = window.setTimeout($ad.advance_slide, duration);
    }
    };
    $ad.advance_slide = function(){
    $ad.old_slide = $ad.slide;
    $ad.slide = $ad.slide.next();
    if ($ad.slide.length === 0){
        $ad.refresh_slides();
    }else{
        $ad.show_slide();
    }
    };
    $ad.back_slide = function(){
    $ad.slide = $ad.slide.prev();
    if ($ad.slide.length === 0){
        $ad.refresh_slides();
    }else{
        $ad.show_slide();
    }
    };

    $(document).on("click", '#advance_slide', $ad.advance_slide);
    $(document).on("click", "#back_slide", $ad.back_slide);

    $ad.init();

    return $ad;
};

/////////////////////////////
// Document initialization //
/////////////////////////////

$(document).ready(function(){

    //Settings form
    document.settings_form = FormDialog(
    "/settings",
    null,
    function(e, form){
        e.preventDefault();
        var data = $(form).serialize();
        $.post(
        $(form).attr("action"),
        data,
        function(){
            $("#_dialog_").dialog("close");
        }
        );
    });

    //DB init form
    document.initialize_db_form = FormDialog(
    "/initialize",
    //init function
    function(form){
        var $submit_btn = form.find("input[type=submit]");
        $submit_btn.set_enabled(false);
        form.find("#init_db").on("change", function(){
        $submit_btn.set_enabled($(this).is(":checked"));
        });
    },
    //submit function
    function(e, form){
        e.preventDefault();
        var location = window.location;
        var formdata = form.serialize();
        $.post(
        form.attr("action"),
        formdata,
        function(){
            window.location = location;
            window.location.reload();
        }
        );
    });

    //Announcement editing
    function set_editor_bg_image(editor, bg_image, bg_image_mode){
    console.log(editor, bg_image, bg_image_mode);
    if (bg_image){
        editor.style['background-image'] = "url('" + bg_image + "')";
    }
    if (bg_image_mode === 'stretch'){
        editor.style['background-size'] = '100%';
    }else if (['left', 'right', 'center'].includes(bg_image_mode)){
        editor.style['background-position'] = bg_image_mode;
        editor.style['background-repeat'] = 'no-repeat';
        editor.style['background-size'] = 'auto';
    }else if (bg_image_mode == 'tile'){
        editor.style['background-size'] = 'auto';
        editor.style['background-repeat'] = 'repeat';
    }
    }

    document.edit_form  = FormDialog(
    "/edit",
    //init function
    function(form){
        form.on('change', 'input[name=fg_color],input[name=bg_color]', function(e){
        //make the CKEDITOR reflect the changes.
        var editor_doc = CKEDITOR.instances.announcement_content_textarea.document.getBody()["$"];
        var $this = $(this);
        if ($this.attr("name") === "fg_color"){
            editor_doc.style["color"] = $this.val();
        }else{
            editor_doc.style["background-color"] = $this.val();
        }
        });

        form.on('change', 'input[name=bg_image],select[name=bg_image_mode]', function(e){
        var editor_doc = CKEDITOR.instances.announcement_content_textarea.document.getBody()["$"];
        var $form = $(this).closest('FORM');
        var img_input = $form.find('input[type=file]');
        var img_url;
        if (img_input.length > 0){
            var img = img_input[0].files[0];
            if (img.type.match(/^image\//)){
            img_url = window.URL.createObjectURL(img);
            }
        }else{
            img_url = $form.find("#bg_image_preview").attr('src');
        }
        var bg_image_mode = $form.find('SELECT[name=bg_image_mode]').val();
        set_editor_bg_image(editor_doc, img_url, bg_image_mode);
        });

        form.on('change', 'input[name=delete]', function(e){
        var $delcb = $(this);

        if ($delcb.is(':checked')){
            form.find(':input:not([type=hidden],[name=delete],[type=submit])').each(function(i, el){
            $(el).set_enabled(false);
            });
        }else{
            form.find(':input').each(function(i, el){
            $(el).set_enabled(true);
            });
        }
        });

        $.when(form.find(".ckedit").ckeditor().promise).then(
        function(){
            var editor_doc = CKEDITOR.instances.announcement_content_textarea.document.getBody()["$"];
            form.find("input[type=color]").each(function(i, el){
            $(el).trigger("change");
            });
            var img = form.find("#bg_image_preview");
            var bg_image_mode = form.find('SELECT[name=bg_image_mode]').val();
            if (img.length > 0){
            set_editor_bg_image(editor_doc, img.attr("src"), bg_image_mode);
            }
            //fit text to the editor like the real thing does
            fit_el_to_parent(editor_doc, $('iframe')[0]);
            $(editor_doc).on('keyup', function(){
            fit_el_to_parent(editor_doc, $('iframe')[0]);
            });

        });
        //this code should simulate maximizing the text in the editor window
        //too bad it doesn't work...
        form.on('keyup', 'textarea[name=content]', function(){
        var editor_doc = CKEDITOR.instances.announcement_content_textarea.document.getBody()["$"];
        fit_el_to_parent(editor_doc, $('iframe')[0]);
        });


    });

    //cleaning expired

    document.clean_expired_form = FormDialog(
    "/clean_expired",
    null,
    function(e, form){
        e.preventDefault();
        form.find('input[type=submit]').set_enabled(false);
        form.find('input[type=submit]').attr("value", 'Please wait...');
        $.post(form.attr("action"), null, function(){
        window.location.reload();
        });
    }
    );

    //Buttons!

    $("#new_announcement A").on("click", function(){document.edit_form.showform();});
    $("#link_settings A").on("click", function(){document.settings_form.showform();});
    $("#link_initialize A").on("click", function(){document.initialize_db_form.showform();});
    $("#link_clean_expired A").on("click", function(){document.clean_expired_form.showform();});

    //The announcment list

    document.announcement_list = AnnouncementList("#announcement_list", "#search");

    //announcement display
    var prevmatch = window.location.pathname.match(/.*\/preview.*/);
    var is_preview = prevmatch && prevmatch[0].length > 0;
    document.announcement_display = AnnouncementDisplay("#announcements", !is_preview);

});//End document.ready()
