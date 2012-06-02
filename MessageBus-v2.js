(function(window,undefined){
    var id = 1;
    var subTree = {t:{},h:[]};
    var pubItems = {};
    var globalConfig = {
        cache : true
    };
    var toString = Object.prototype.toString;

    var generateId = function(prefix){
        return (prefix || '') + id++;
    };

    var throwException = function(msg){
        throw new Error(msg);
    };

    var illegalTopic = function(topic){
        throwException('illegalTopic:' + topic);
    };

    var checkSubTopic = function(topic){
        (!topic || !topic.length || toString.call(topic) != '[object String]' 
            || /\*{2}\.\*{2}/.test(topic)
            || /([^\.\*]\*)|(\*[^\.\*])/.test(topic)
            || /(\*\*\.\*)|(\*\.\*\*)/.test(topic)
            || /\*{3}/.test(topic) || /\.{2}/.test(topic)
            || topic[0] == '.' || topic[topic.length-1] == '.') && illegalTopic(topic);
    };

    var checkIllegalCharactor = function(topic){
        var m = /([\^])/.exec(topic);
        if(m){
            throwException('illegalCharactor:' + m[1]);
        }
    };

    var checkPubTopic = function(topic){
        (!topic || !topic.length || toString.call(topic) != '[object String]' 
            || topic.indexOf('*') != -1 || topic[0] == '.' 
            || /\.{2}/.test(topic)
            || topic[topic.length] == '.') && illegalTopic(topic);
    };

    var doCall = function(topic, msg, handlers, pubId){
        msg = msg || null;
        var wrapFn;
        for(var i = 0, len = handlers.length; i < len; i++){
            wrapFn = handlers[i];
            if(wrapFn.pubId !== pubId){
                wrapFn.pubId = pubId;
                wrapFn.execedTime++;
                if(toString.call(wrapFn.config.execTime) == '[object Number]'
                        && wrapFn.execedTime >= wrapFn.config.execTime){
                    handlers.splice(i,1);
                    i--;
                    len = handlers.length;
                }
                wrapFn.h.call(wrapFn.scope, topic, msg, wrapFn.data);
            }
        }
    };

    var deleteWrapFn = function(h, id){
        for(var i = 0, len = h.length; i < len; i++){
            if(h[i].sid == id){
                h.splice(i,1);
                break;
            }
        }
    };

    var match = function(p, t){
        if(p == t || t == '**'){
            return true;
        }
        t = t.replace(/\.\*\*\./g,'(((\\..+?\\.)*)|\\.)');
        t = t.replace(/^\*\*\./,'(.+?\\.)*');
        t = t.replace(/\.\*\*$/,'(\\..+?)*');

        t = t.replace(/\.\*\./g,'(\\..+?\\.)');
        t = t.replace(/^\*\./g,'(.+?\\.)');
        t = t.replace(/\.\*$/g,'(\\..+?)');

        return new RegExp(t).test(p);
    };

    var query = function(topic){
        var msgs = [];
        for(var p in pubItems){
            if(match(p, topic)){
                msgs.push({topic : p, value : pubItems[p]});
            }
        }
        return msgs;
    };

    var MessageBus = {
        version : '1.0',

        subscribe : function(topic, handler, scope, data, config){
            checkSubTopic(topic); 
            checkIllegalCharactor(topic);
            scope = scope || window;
            config = config || {};

            var sid = generateId();
            var wrapFn = {h : handler, scope : scope, data : data, sid : sid, execedTime : 0, config : config};
            var path = topic.split('.'), i = 0, len = path.length;
            
            (function(path, index, handler, tree){
                var token = path[index];
                if(index == path.length){
                    tree.h.push(handler); 
                }else{
                    if(!tree.t[token]){
                        tree.t[token] = {t:{}, h:[]};
                    }
                    arguments.callee.call(this, path, ++index, handler, tree.t[token]);
                }
            })(path, 0, wrapFn, subTree);

            if(globalConfig.cache && !!config.cache){
                var msgs = query(topic);
                for(i = 0, len = msgs.length; i < len; i++){
                    handler.call(scope, msgs[i].topic, msgs[i].value, data);
                }
            }
            return topic + '^' + sid;
        },
        publish : function(topic, msg){
            checkPubTopic(topic);
            checkIllegalCharactor(topic);

            pubItems[topic] = msg;

            var path = topic.split('.');
            var tree = subTree;
            var token;

            (function(path, index, tree, msg, topic, pubId, seed){
                var token = path[index];
                if(index == path.length){
                    doCall(topic, msg, (seed && seed.isWildcard) ? tree.t['**'].h : tree.h, pubId);
                }else{
                    if(tree.t['**']){
                        if(tree.t['**'].t[token]){
                            arguments.callee.call(this, path, index + 1, tree.t['**'].t[token], msg, topic, pubId, {index : index, tree:tree});
                        }else{
                            arguments.callee.call(this, path, index + 1, tree, msg, topic, pubId, {isWildcard : true});
                        }
                    }
                    if(tree.t[token]){
                        arguments.callee.call(this, path, index + 1, tree.t[token], msg, topic, pubId);
                    }else if(seed && !seed.isWildcard){
                        arguments.callee.call(this, path, ++seed.index, seed.tree, msg, topic, pubId, seed);
                    }
                    if(tree.t['*']){
                        arguments.callee.call(this, path, index + 1, tree.t['*'], msg, topic, pubId);
                    }
                }
            })(path, 0, tree, msg, topic, generateId());
        },
        unsubscribe : function(sid){
            var sid = sid.split('^');
            if(sid.length != 2){
                throwException('illegal sid:' + sid);
            }
            var path = sid[0].split('.');
            var id = sid[1];

            (function(path, index, tree, id){
                var token = path[index];
                if(index == path.length){
                    deleteWrapFn(tree.h, id);
                }else{
                    if(tree.t[token]){
                        arguments.callee.call(this,path, ++index, tree.t[token], id);
                    }            
                }
            })(path, 0, subTree, id);
        },
        setConfig : function(c){
            if(c && toString.call(c) == '[object Object]'){
                for(var p in c){
                    globalConfig[p] = c[p];
                }
            }
        }
    }; 

    window.MessageBus = MessageBus;
})(window,undefined);
