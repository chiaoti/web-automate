const express = require('express')
const Automate = require('@chiaoti/automate')

module.exports = function (specPath, dbPath) {
  const router = express.Router()
  const automate = new Automate({
    standalone: false,
    paths: {
      specs: specPath,
      db: dbPath
    }
  })
  const stagingActions = []

  function stop (req, res, next) {
    automate.stop()
    next()
  }

  /*
   * Start automate
   */
  router.post('/', stop, function (req, res) {
    automate
      .initialize()
      .then(() => {
        automate.start()
        res.sendStatus(200)
      })
  })

  /*
   * Stop automate
   */
  router.delete('/', stop, function (req, res) {
    res.sendStatus(200)
  })

  /*
   * Get supported services
   */
  router.get('/services', function (req, res) {
    res.json(automate.services.map(srv => srv.toObject()))
  })

  /*
   * Get all methods provided by supported services
   */
  router.get('/methods', function (req, res) {
    res.json(
      automate.services
        .map(srv => srv.methods.map(m => m.toObject()))
        .reduce((ma, mb) => ma.concat(mb))
    )
  })

  /*
   * Get all flows created by user
   */
  router.get('/flows', function (req, res) {
    res.json(automate.flows.map(flow => flow.toObject()))
  })

  /*
   * Create a flow
   */
  router.post('/flow', stop, function (req, res) {
    const flow = automate.createFlow(req.body)
    res.status(200).send(flow.id)
  })

  /*
   * Get flow by ID
   */
  router.get('/flow/:id', function (req, res) {
    const flow = automate.getFlowById(req.params.id)
    if (flow) res.json(flow.toObject())
    else res.sendStatus(404)
  })

  /*
   * Update flow by ID
   */
  router.put('/flow/:id', stop, function (req, res) {
    const flow = automate.getFlowById(req.params.id)
    if (!flow) {
      res.sendStatus(404)
      return
    }

    flow.name = req.body.name
    flow.description = req.body.description
    flow.owner = req.body.owner
    flow.lastModifiedDate = new Date()
    flow.active = req.body.active
    flow.logo = req.body.logo

    if (Array.isArray(req.body.tags)) {
      flow.tags.forEach(tag => flow.removeTag(tag))
      req.body.tags.forEach(tag => flow.addTag(tag))
    }

    if (Array.isArray(req.body.triggers)) {
      flow.triggers.forEach(event => flow.removeTrigger(event))
      req.body.triggers.forEach(event => flow.addTrigger(event))
    }
  })

  /*
   * Destroy flow by ID
   */
  router.delete('/flow/:id', stop, function (req, res) {
    const flow = automate.getFlowById(req.params.id)
    if (!flow) {
      res.sendStatus(404)
      return
    }

    automate.destroyFlow(flow)
    res.sendStatus(200)
  })

  /*
   * Run a flow
   */
  router.post('/flow/:id', stop, function (req, res) {
    const args = req.body
    const flow = automate.getFlowById(req.params.id)

    if (!flow) {
      res.sendStatus(404)
      return
    }

    automate.emit(Automate.InternalEvents.Run, {
      flows: [flow],
      args
    })

    res.sendStatus(200)
  })

  /*
   * Add an action in staging area to a flow
   */
  router.post('/flow/:flowId/action/:actionId', stop, function (req, res) {
    const stagingAction = stagingActions[req.params.actionId]
    const flow = automate.getFlowById(req.params.flowId)

    if (!stagingAction || !flow) {
      res.sendStatus(404)
      return
    }

    flow.addAction(stagingAction)
    res.sendStatus(200)
  })

  /*
   * Move an action to given position in a flow
   */
  router.put('/flow/:flowId/action/:actionId/position/:pos', stop, function (req, res) {
    const flow = automate.getFlowById(req.params.flowId)

    if (!flow) {
      res.status(404).send('Flow not found')
      return
    }

    const action = flow.getActionById(req.params.actionId)

    if (!action) {
      res.status(404).send('Action not found')
      return
    }

    flow.moveAction(action, req.params.pos)
    res.sendStatus(200)
  })

  /*
   * Remove an action in a flow
   */
  router.delete('/flow/:flowId/action/:actionId', stop, function (req, res) {
    const flow = automate.getFlowById(req.params.flowId)

    if (!flow) {
      res.sendStatus(404)
      return
    }

    flow.removeActionById(req.params.actionId)
    res.sendStatus(200)
  })

  /*
   * Get all actions in staging area
   */
  router.get('/staging/actions', function (req, res) {
    res.json(stagingActions.map(action => action.toObject()))
  })

  /*
   * Create an action in staging area
   */
  router.post('/staging/action', function (req, res) {
    const service = automate.findServiceByName(req.body.service)
    if (!service) {
      res.status(404).send('Given service not found.')
      return
    }

    const method = service.findMethod(req.body.method)
    if (!method) {
      res.status(404).send('Given method not found.')
      return
    }

    const action = automate.createAction(req.body)
      .applyMethod(method)
      .withArgs(req.body.args)

    stagingActions.push(action)
    res.status(200).send(action.id)
  })

  /*
   * Get an action in staging area by ID
   */
  router.get('/staging/action/:id', function (req, res) {
    const action = stagingActions.find(action => action.id === req.params.id)

    if (action) {
      res.json(action.toObject())
    } else {
      res.sendStatus(404)
    }
  })

  /*
   * Remove an action in staging area by ID
   */
  router.delete('/staging/action/:id', function (req, res) {
    const index = stagingActions.findIndex(action => action.id === req.params.id)

    if (index >= 0) {
      stagingActions.splice(index, 1)
      res.sendStatus(200)
    } else {
      res.sendStatus(404)
    }
  })

  return router
}
