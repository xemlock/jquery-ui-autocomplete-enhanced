/**
 * Functionality and usability enhancements for jQuery UI autocomplete widget.
 * This plugin is compatible with jQuery UI 1.8 and 1.9.
 * Additional options supported:
 *   renderItem
 *   renderValue
 *   response (response handler for versions prior to 1.9, supported only for
 *             Array and string source option)
 *   cacheXhr
 *
 * Source can be specified either directly or by data-source attribute.
 *
 * @author xemlock
 * @version 2019-01-27 / 2014-06-06 / 2014-02-26 / 2013-07-20
 */
jQuery.fn.autocomplete = (function (autocomplete) {
    "use strict";

    var version = 0,
        needResponseSupport = false;

    $.each(
        "1.9.0".split('.').concat([0, 0, 0]).slice(0, 3),
        function (key, value) {
            version = 100 * version + (parseInt(value, 10) || 0);
        }
    );

    // transform version number to version id where each part contains two
    // digits, i.e. 1.10.3 transforms to 1010030
    $.each(
        $.ui.autocomplete.version.split('.').concat([0, 0, 0]).slice(0, 3),
        function (key, value) {
            version = 100 * version + (parseInt(value, 10) || 0);
        }
    );

    needResponseSupport = version < 10900;

    function enhancedAutocomplete(options) {
        if (typeof options === 'string') {
            // method call on existing autocomplete widget
            var args = Array.prototype.slice.apply(arguments);
            return autocomplete.apply(this, args);
        }

        options = $.extend({}, options);

        // autocomplete widget initialization
        var optSource = options.source,
            optOpen = options.open,
            optSelect = options.select,
            optFocus = options.focus,
            optClose = options.close,
            optResponse,
            cacheXhr,
            _response,
            _renderItem,
            _renderValue;

        // since version 1.9 data keys are prefixed with ui-
        // response event was added in 1.9
        if (needResponseSupport) {
            optResponse = options.response;
            delete options.response;

            _response = function (callback, data) {
                this.element.trigger('autocompleteresponse', {
                    content: data || []
                });
                callback(data);
            };

        } else {
            _response = function (callback, data) {
                callback(data);
            };
        }

        // prepare item and value renderers
        if ('function' === typeof options.renderItem) {
            _renderItem = options.renderItem;
        } else {
            _renderItem = function (item) {
                return (item && typeof item === 'object') ? item.label : ('' + item);
            };
        }
        delete options.renderItem;

        if ('function' === typeof options.renderValue) {
            _renderValue = options.renderValue;
        } else {
            _renderValue = _renderItem;
        }
        delete options.renderValue;

        // XHR cache control, applies to source given as a string
        if ('undefined' === typeof options.cache) {
            cacheXhr = true;
        } else {
            cacheXhr = !!options.cache;
        }
        delete options.cache;

        options.open = function (event, ui) {
            try {
                var j = $(this),
                    d = j.data('ui-autocomplete') || j.data('autocomplete'),
                    m = d.menu.element,
                    // set suggestions list to be the same width as text
                    // input this widget is bound to
                    w = j.outerWidth() -
                        parseInt(j.css('borderLeftWidth'), 10) -
                        parseInt(j.css('borderRightWidth'), 10),
                    z = 0;

                // set zIndex of suggestion list as a maximum of zIndexes
                // encountered
                // on a path from text input to document body
                j.parents().each(function () {
                    // jQuery zIndex getter, returns (from version 1.5 onwards) a float value:
                    //
                    // >>> document.body.style.zIndex = 1234567890;
                    // >>> document.body.style.zIndex
                    // "1234567890"
                    // >>> $(document.body).css('zIndex')
                    // "1.23457e+9"
                    z = Math.max(z, $(this).css('zIndex') | 0);
                });

                m.css({width: w, zIndex: 1 + z});

                // jQuery UI (1.10 at least) is so clever, that it tries to
                // compensate for marginTop when positioning autocomplete UL.
                // Revert this unholy behavior.
                var marginTop = parseInt(m.css('marginTop'), 10);
                if (marginTop) {
                    m.css('top', parseInt(m.css('top'), 10) + marginTop);
                }

            } catch (e) {}

            if (typeof optOpen === 'function') {
                optOpen.apply(this, [event, ui]);
            }
        };

        options.focus = function (event, ui) {
            $(this).val(_renderValue(ui.item));
            if (typeof optFocus === 'function') {
                optFocus.apply(this, [event, ui]);
            }
            // without this when up/down key is pressed to navigate
            // within result list, item value and not label is inserted
            // into input
            return false;
        };

        options.select = function (event, ui) {
            $(this).val(_renderValue(ui.item));
            if (typeof optSelect === 'function') { 
                optSelect.apply(this, [event, ui]);
            }
            // without this input value will be set to that inserted
            // by user, not selected from result list
            return false; 
        };

        options.close = function (event, ui) {
            if (typeof optClose === 'function') {
                optClose.apply(this, [event, ui]);
            }
            return false;
        };

        // source method is executed in the widget context
        if (optSource instanceof Array) {
            options.source = function (request, response) {
                var data = autocomplete.filter(optSource, request.term);
                _response.apply(this, [response, data]);
            };

        } else if (typeof optSource === 'string') {
            // enable cache for xhr requests, add support for response handler
            var cache = {},
                xhr;

            options.source = function (request, response) {
                var that = this,
                    term;

                if (typeof options.beforeSend === 'function') {
                    // cancel request on false
                    if (false === options.beforeSend.apply(that, [request, response])) {
                        _response.apply(that, [response]);
                        return;
                    }
                }

                term = request.term;
                if (cacheXhr && (term in cache)) {
                    _response.apply(that, [response, cache[term]]);
                    return;
                }

                if (xhr) {
                    xhr.abort();
                }

                xhr = $.ajax({
                    url: optSource,
                    data: request,
                    dataType: 'json',
                    success: function (data) {
                        cache[term] = data;
                        _response.apply(that, [response, data]);
                    },
                    error: function () {
                        _response.apply(that, [response]);
                    }
                });
            };
        }

        var renderItemLi = function (ul, item) {
            return $('<li/>')
                .data('item.autocomplete', item)
                .append(
                    $('<a/>').append(_renderItem(item))
                )
                .appendTo(ul);
        };

        // create autocomplete widget and setup item renderer
        this.each(function () {
            var el = $(this),
                noSource = false,
                data;

            // if source was not provided in options, get source from
            // data-source attribute
            if ('undefined' === typeof options.source) {
                noSource = true;
                options.source = el.data('source');
            }

            this.setAttribute('autocomplete', 'off');
            autocomplete.call(el, options);

            data = el.data('ui-autocomplete') || el.data('autocomple');
            data._renderItem = renderItemLi;

            if (noSource) {
                delete options.source;
            }
        });

        if (needResponseSupport && typeof optResponse === 'function') {
            this.bind('autocompleteresponse', function (event, ui) {
                optResponse.apply(this, [event, ui]);
            });
        }

        return this;
    };

    enhancedAutocomplete.autocomplete = autocomplete;
    return enhancedAutocomplete;

})(jQuery.fn.autocomplete);
