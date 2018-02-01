/*
 * Copyright (C) 2016  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


function yomichan() {
    return chrome.extension.getBackgroundPage().yomichan;
}

function fieldsToDict(selection) {
    const result = {};
    selection.each((index, element) => {
        result[$(element).data('field')] = $(element).val();
    });

    return result;
}

function modelIdToFieldOptKey(id) {
    return {
        'anki-vocab-model': 'ankiVocabFields'
    }[id];
}

function modelIdToMarkers(id) {
    return {
        'anki-vocab-model': [
            'expression',
            'reading',
            'glossary',
            'g-list',
            'sentence',
            'cloze',
            'url',
            'audio'
        ]
    }[id];
}

function formToOptions(section, callback) {
    loadOptions((optsOld) => {
        const optsNew = $.extend({}, optsOld);

        switch (section) {
            case 'general':
                optsNew.activateOnStartup   = $('#activate-on-startup').prop('checked');
                optsNew.selectMatchedText   = $('#select-matched-text').prop('checked');
                optsNew.enableAudioPlayback = $('#enable-audio-playback').prop('checked');
                optsNew.enableOnlineDict    = $('#enable-online-dictionary').prop('checked');
                optsNew.disableAnkiOption   = $('#disable-anki-option').prop('checked');
                optsNew.enableAnkiConnect   = $('#enable-ankiconnect').prop('checked');
                optsNew.enableAnkiWeb       = $('#enable-ankiweb').prop('checked');
                break;
            case 'anki':
                optsNew.ankiCardTags    = $('#anki-card-tags').val().split(/[,; ]+/);
                optsNew.sentenceExtent  = parseInt($('#sentence-extent').val());
                optsNew.ankiVocabDeck   = $('#anki-vocab-deck').val();
                optsNew.ankiVocabModel  = $('#anki-vocab-model').val();
                optsNew.ankiVocabFields = fieldsToDict($('#vocab .anki-field-value'));
                optsNew.ankiwebUsername = $('#ankiweb-username').val();;
                optsNew.ankiwebPassword = $('#ankiweb-password').val();;
                break;
        }

        callback(sanitizeOptions(optsNew), sanitizeOptions(optsOld));
    });
}

function populateAnkiDeckAndModel(opts) {
    const yomi = yomichan();

    const ankiDeck = $('.anki-deck');
    ankiDeck.find('option').remove();
    yomi.api_getDeckNames({callback: (names) => {
        if (names !== null) {
            names.forEach((name) => ankiDeck.append($('<option/>', {value: name, text: name})));
        }

        $('#anki-vocab-deck').val(opts.ankiVocabDeck);
    }});

    const ankiModel = $('.anki-model');
    ankiModel.find('option').remove();
    yomi.api_getModelNames({callback: (names) => {
        if (names !== null) {
            names.forEach((name) => ankiModel.append($('<option/>', {value: name, text: name})));
        }

        populateAnkiFields($('#anki-vocab-model').val(opts.ankiVocabModel), opts);
    }});
}

function updateAnkiStatus() {
    $('.error-dlg').hide();
    yomichan().api_getVersion({callback: (version) => {
        if (version === null) {
            $('.error-dlg-connection').show();
            $('.options-anki-controls').hide();
        } else if (version > yomichan().getApiVersion()) {
            $('.error-dlg-version').show();
            $('.options-anki-controls').hide();
        } else {
            $('.options-anki-controls').show();
        }
    }});
}

function populateAnkiFields(element, opts) {
    const modelName = element.val();
    if (modelName === null) {
        return;
    }

    const modelId = element.attr('id');
    const optKey = modelIdToFieldOptKey(modelId);
    const markers = modelIdToMarkers(modelId);

    yomichan().api_getModelFieldNames({modelName, callback: (names) => {
        const table = element.closest('.tab-pane').find('.anki-fields');
        table.find('tbody').remove();

        const tbody = $('<tbody>');
        names.forEach((name) => {
            const button = $('<button>', {type: 'button', class: 'btn btn-default dropdown-toggle'});
            button.attr('data-toggle', 'dropdown').dropdown();

            const markerItems = $('<ul>', {class: 'dropdown-menu dropdown-menu-right'});
            for (let marker of markers) {
                const link = $('<a>', {href: '#'}).text(`{${marker}}`);
                link.click((e) => {
                    e.preventDefault();
                    link.closest('.input-group').find('.anki-field-value').val(link.text()).trigger('change');
                });
                markerItems.append($('<li>').append(link));
            }

            const groupBtn = $('<div>', {class: 'input-group-btn'});
            groupBtn.append(button.append($('<span>', {class: 'caret'})));
            groupBtn.append(markerItems);

            const group = $('<div>', {class: 'input-group'});
            group.append($('<input>', {type: 'text', class: 'anki-field-value form-control', value: opts[optKey][name] || ''}).data('field', name).change(onOptionsAnkiChanged));
            group.append(groupBtn);

            const row = $('<tr>');
            row.append($('<td>', {class: 'col-sm-2 text-nowrap'}).text(name));
            row.append($('<td>', {class: 'col-sm-10'}).append(group));

            tbody.append(row);
        });

        table.append(tbody);
    }});
}

function onOptionsGeneralChanged(e) {
    if (!e.originalEvent && !e.isTrigger) {
        return;
    }

    formToOptions('general', (optsNew, optsOld) => {
        saveOptions(optsNew, () => {
            yomichan().setOptions(optsNew);
            if (optsNew.enableAnkiConnect || optsNew.enableAnkiWeb) {
                updateAnkiStatus();
                populateAnkiDeckAndModel(optsNew);
                $('.options-anki').show();
                if (optsNew.enableAnkiWeb) {
                    $('.options-ankiweb').show();
                } else {
                    $('.options-ankiweb').hide();
                }
            } else {
                $('.options-anki').hide();
            }


            if (optsNew.showAdvancedOptions) {
                $('.options-advanced').show();
            } else {
                $('.options-advanced').hide();
            }
        });
    });
}

function onOptionsAnkiChanged(e) {
    if (!e.originalEvent && !e.isTrigger) {
        return;
    }

    formToOptions('anki', (opts) => {
        saveOptions(opts, () => yomichan().setOptions(opts));
    });
}

function onAnkiModelChanged(e) {
    if (e.originalEvent) {
        formToOptions('anki', (opts) => {
            opts[modelIdToFieldOptKey($(this).id)] = {};
            populateAnkiFields($(this), opts);
            saveOptions(opts, () => yomichan().setOptions(opts));
        });
    }
}

function onAnkiwebClicked(e) {
    if (!e.originalEvent && !e.isTrigger) {
        return;
    }

    formToOptions('anki', (opts) => {
        saveOptions(opts, () => {
            yomichan().setOptions(opts);
            yomichan().connectAnkiweb(result => {
                yomichan().ankiwebConnected = result;
                updateAnkiStatus();
                populateAnkiDeckAndModel(opts);
            });
        });
    });
}

$(document).ready(() => {
    loadOptions((opts) => {
        $('#activate-on-startup').prop('checked', opts.activateOnStartup);
        $('#select-matched-text').prop('checked', opts.selectMatchedText);
        $('#enable-audio-playback').prop('checked', opts.enableAudioPlayback);
        $('#enable-online-dictionary').prop('checked', opts.enableOnlineDict);
        $('#disable-anki-option').prop('checked', opts.disableAnkiOption);
        $('#enable-ankiconnect').prop('checked', opts.enableAnkiConnect);
        $('#enable-ankiweb').prop('checked', opts.enableAnkiWeb);

        $('#ankiweb-username').val(opts.ankiwebUsername);
        $('#ankiweb-password').val(opts.ankiwebPassword);

        $('#anki-card-tags').val(opts.ankiCardTags.join(' '));
        $('#sentence-extent').val(opts.sentenceExtent);

        $('.options-general input').change(onOptionsGeneralChanged);
        $('.options-anki input').change(onOptionsAnkiChanged);

        $('#ankiweb-go').click(onAnkiwebClicked);

        $('.anki-deck').change(onOptionsAnkiChanged);
        $('.anki-model').change(onAnkiModelChanged);

        if (opts.showAdvancedOptions) {
            $('.options-advanced').show();
        }

        if (opts.enableAnkiConnect || opts.enableAnkiWeb) {
            updateAnkiStatus();
            populateAnkiDeckAndModel(opts);
            $('.options-anki').show();
            if (opts.enableAnkiWeb) {
                $('.options-ankiweb').show();
            } else {
                $('.options-ankiweb').hide();
            }
        } else {
            $('.options-anki').hide();
        }


        });
});
