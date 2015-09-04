'use strict';

process.env.TZ = 'UTC';

module.exports = function(env) {
	var fs = require('fs');
	var path = require('path');
	var jsdom = require('jsdom');
	var sinon = require('sinon');
	var config = require('../../lib/config')(env || 'development', null, {});
	var renderer = null;
	var assetPath = null;
	var $ = fs.readFileSync(path.join(__dirname, '..', 'client', 'lib', 'jquery-1.9.1.js')).toString();

	return {
		getDust: function() {
			return renderer.dust;
		},

		setup: function() {
			var args = [].slice.call(arguments, 0);

			config.timer = sinon.stub().returns(sinon.stub());
			renderer = require('../../lib/renderer')(config);
			assetPath = sinon.stub(renderer, 'assetPath').returnsArg(0);
			renderer.initDustExtensions();
			if (args.length) {
				if (args[0] === 'all') {
					// We need to pretend to the renderer it is being called from a host app, not the Mocka process
					renderer.compileTemplates('.');
				} else {
					renderer.compilePaths.apply(renderer, [].slice.call(arguments, 0));
				}
			}
		},
		teardown: function() {
			renderer.dust.cache = {};
			renderer = null;
			assetPath.restore();
		},
		data: function(file) {
			if (/\.json$/.test(file)) {
				var json = fs.readFileSync(path.join(config.path.root, file), 'utf8');
				return JSON.parse(json);
			}
			return require(path.join(config.path.root, file));
		},
		render: function(template, req, res, data, callback) {
			// jscs:disable disallowDanglingUnderscores
			var _req;
			var _res;
			var _data;
			var _callback;

			if (arguments.length === 3) {
				_req = {url: ''};
				_res = {};
				_data = req;
				_callback = res;
			} else if (arguments.length === 5) {
				_req = req;
				_res = res;
				_data = data;
				_callback = callback;
			} else {
				throw new Error('Invalid arguments for render test helper');
			}

			if (template.indexOf('{') !== -1) {
				if (!renderer) {
					this.setup();
				}
				renderer.dust.loadSource(renderer.dust.compile(template, 'test-template'));
				template = 'test-template';
			}

			renderer.renderPartial(template, _req, _res, _data, function(err, raw) {
				if (!raw) {
					if (!_data) {
						console.error('No test data to render');
					} else if (!_data.layout || !_data.layout.namespace) {
						console.error('Namespace was not specified in test data');
					}
					_callback(err, null, null);
				} else {
					jsdom.env({
						html: raw,
						src: [$],
						done: function(err, dom) {
							_callback(err, dom, raw);
						}
					});
				}
			});
			// jscs:enable disallowDanglingUnderscores
		}
	};
};
