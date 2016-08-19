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


class TextSourceRange {
    constructor(range) {
        this.rng = range;
    }

    clone() {
        return new TextSourceRange(this.rng.cloneRange());
    }

    text() {
        return this.rng.toString();
    }

    //set English words offset by words count (not character count) 
    setWordsOffset(){
        var a=this.rng;
        do if(a){
            var g=a.cloneRange();
            if(a.startContainer.data){

                function isAlpha(a){
                    return /\w/.test(a);
                }

                function getStartPos(backward_count){
                    var count=0, b='', pos=a.startOffset;
                    for(;pos>=1;){
                        g.setStart(a.startContainer,--pos);
                        b=g.toString();
                        if(!isAlpha(b.charAt(0))){
                            count++;
                            if(count==backward_count){
                                break
                            }
                        }
                    }

                    return pos;
                }

                function getEndPos(forward_count){
                    var count=0, b='', pos=a.endOffset;
                    for(;pos<a.endContainer.data.length;){
                        g.setEnd(a.endContainer,++pos);
                        b=g.toString();
                        if(!isAlpha(b.charAt(b.length-1))){
                            count++;
                            if(count==forward_count){
                                break
                            }
                        }
                    }

                    return pos;
                }

                var startPos = getStartPos(1);
                var endPos = getEndPos(2);
                
                this.rng.setStart(a.startContainer,startPos==0?0:startPos+1);
                this.rng.setEnd(a.endContainer,endPos==a.endContainer.data.length?endPos:endPos-1);
            }

        }while(0);
        
        return null;
    }
    
    setEndOffset(length) {
        const lengthAdj = length + this.rng.startOffset;
        const state = TextSourceRange.seekForward(this.rng.startContainer, lengthAdj);
        this.rng.setEnd(state.node, state.offset);
        return length - state.length;
    }

    setStartOffset(length) {
        const lengthAdj = length + (this.rng.startContainer.length - this.rng.startOffset);
        const state = TextSourceRange.seekBackward(this.rng.startContainer, lengthAdj);
        this.rng.setStart(state.node, state.offset);
        return length - state.length;
    }

    containsPoint(point) {
        const rect = this.getPaddedRect();
        return point.x >= rect.left && point.x <= rect.right;
    }

    getRect() {
        return this.rng.getBoundingClientRect();
    }

    getPaddedRect() {
        const range = this.rng.cloneRange();
        const startOffset = range.startOffset;
        const endOffset = range.endOffset;
        const node = range.startContainer;

        range.setStart(node, Math.max(0, startOffset - 1));
        range.setEnd(node, Math.min(node.length, endOffset + 1));

        return range.getBoundingClientRect();
    }

    select() {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.rng);
    }

    deselect() {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }

    equals(other) {
        return other.rng && other.rng.compareBoundaryPoints(Range.START_TO_START, this.rng) == 0;
    }

    static seekForward(node, length) {
        const state = {node, offset: 0, length};
        if (!TextSourceRange.seekForwardHelper(node, state)) {
            return state;
        }

        for (let current = node; current !== null; current = current.parentElement) {
            for (let sibling = current.nextSibling; sibling !== null; sibling = sibling.nextSibling) {
                if (!TextSourceRange.seekForwardHelper(sibling, state)) {
                    return state;
                }
            }
        }

        return state;
    }

    static seekForwardHelper(node, state) {
        if (node.nodeType === 3) {
            const consumed = Math.min(node.length, state.length);
            state.node = node;
            state.offset = consumed;
            state.length -= consumed;
        } else {
            for (let i = 0; i < node.childNodes.length; ++i) {
                if (!TextSourceRange.seekForwardHelper(node.childNodes[i], state)) {
                    break;
                }
            }
        }

        return state.length > 0;
    }

    static seekBackward(node, length) {
        const state = {node, offset: node.length, length};
        if (!TextSourceRange.seekBackwardHelper(node, state)) {
            return state;
        }

        for (let current = node; current !== null; current = current.parentElement) {
            for (let sibling = current.previousSibling; sibling !== null; sibling = sibling.previousSibling) {
                if (!TextSourceRange.seekBackwardHelper(sibling, state)) {
                    return state;
                }
            }
        }

        return state;
    }

    static seekBackwardHelper(node, state) {
        if (node.nodeType === 3) {
            const consumed = Math.min(node.length, state.length);
            state.node = node;
            state.offset = node.length - consumed;
            state.length -= consumed;
        } else {
            for (let i = node.childNodes.length - 1; i >= 0; --i) {
                if (!TextSourceRange.seekBackwardHelper(node.childNodes[i], state)) {
                    break;
                }
            }
        }

        return state.length > 0;
    }
}
