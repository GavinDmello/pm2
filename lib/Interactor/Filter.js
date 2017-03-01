/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * @file Filter process and system data to be sent to server
 * @author Alexandre Strzelewicz <strzelewicz.alexandre@gmail.com>
 * @project Interface
 */

var os = require('os');

var cpuMeta = {
  number: os.cpus().length,
  info: os.cpus().length > 0 ? os.cpus()[0].model : 'no-data'
};

var Filter = {};

Filter.getProcessID = function (server, name, id) {
  return server + ':' + name + ':' + id;
};

/**
 * Normalize each process metdata
 * @param {Object} processes process data extracted from pm2 daemon
 * @param {Object} conf interactor configuration
  */
Filter.status = function (processes, conf) {
  if (!processes || processes.length === 0) return null;

  var procs = [];

  processes.forEach(function (proc) {
    if (proc.pm2_env.pm_id.toString().indexOf('_old_') > -1) return;

    procs.push({
      pid: proc.pid,
      name: proc.pm2_env.name,
      interpreter: proc.pm2_env.exec_interpreter,
      restart_time: proc.pm2_env.restart_time,
      created_at: proc.pm2_env.created_at,
      exec_mode: proc.pm2_env.exec_mode,
      watching: proc.pm2_env.watch,
      pm_uptime: proc.pm2_env.pm_uptime,
      status: proc.pm2_env.status,
      pm_id: proc.pm2_env.pm_id,

      cpu: Math.floor(proc.monit.cpu) || 0,
      memory: Math.floor(proc.monit.memory) || 0,

      versioning: proc.pm2_env.versioning || null,

      axm_actions: proc.pm2_env.axm_actions || [],
      axm_monitor: proc.pm2_env.axm_monitor || {},
      axm_options: proc.pm2_env.axm_options || {},
      axm_dynamic: proc.pm2_env.dynamic || {}
    });
  });

  var nodeVersion = process.version;
  if (process.version.indexOf('v1.') === 0 || process.version.indexOf('v2.') === 0 || process.version.indexOf('v3.') === 0) {
    nodeVersion = 'iojs ' + nodeVersion;
  }

  return {
    process: procs,
    server: {
      loadavg: os.loadavg(),
      total_mem: os.totalmem(),
      free_mem: os.freemem(),
      cpu: cpuMeta,
      hostname: os.hostname(),
      uptime: os.uptime(),
      type: os.type(),
      platform: os.platform(),
      arch: os.arch(),
      interaction: conf.REVERSE_INTERACT,
      pm2_version: conf.PM2_VERSION,
      node_version: nodeVersion
    }
  };
};

/**
 * Normalize each process cpu and memory data
 * @param {Object} processes process data extracted from pm2 daemon
 * @param {Object} conf interactor configuration
  */
Filter.monitoring = function (processes, conf) {
  if (!processes || processes.length === 0) return null;
  var procs = {};

  processes.forEach(function (proc) {
    procs[Filter.getProcessID(conf.MACHINE_NAME, proc.pm2_env.name, proc.pm2_env.pm_id)] = [
      Math.floor(proc.monit.cpu),
      Math.floor(proc.monit.memory)
    ];
  });

  return {
    loadavg: os.loadavg(),
    total_mem: os.totalmem(),
    free_mem: os.freemem(),
    processes: procs
  };
};

module.exports = Filter;
