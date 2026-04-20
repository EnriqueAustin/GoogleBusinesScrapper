const { Router } = require('express');
const { z } = require('zod');
const { prisma } = require('../exporter'); // reusing the prisma client exported from exporter

const router = Router();

// Zod schemas
const PipelineSchema = z.object({
  name: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const StageReorderSchema = z.object({
  stages: z.array(z.object({
    id: z.string(),
    order: z.number()
  }))
});

const MoveLeadSchema = z.object({
  pipelineId: z.string(),
  stageId: z.string()
});

// GET /api/pipelines - List all pipelines (with stages)
router.get('/pipelines', async (req, res) => {
  try {
    const pipelines = await prisma.pipeline.findMany({
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(pipelines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pipelines' });
  }
});

// POST /api/pipelines - Create a new pipeline
router.post('/pipelines', async (req, res) => {
  try {
    const data = PipelineSchema.parse(req.body);
    const newPipeline = await prisma.pipeline.create({
      data: {
        name: data.name,
        isDefault: data.isDefault || false,
      }
    });
    res.status(201).json(newPipeline);
  } catch (error) {
    res.status(400).json({ error: error.errors || 'Invalid data' });
  }
});

// GET /api/pipelines/:id/stages - Get stages for a pipeline
router.get('/pipelines/:id/stages', async (req, res) => {
  try {
    const stages = await prisma.stage.findMany({
      where: { pipelineId: req.params.id },
      orderBy: { order: 'asc' }
    });
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
});

// PATCH /api/pipelines/:id - Edit pipeline or reorder stages
router.patch('/pipelines/:id', async (req, res) => {
  try {
    // If stages are passed, do a bulk update of order
    const data = StageReorderSchema.safeParse(req.body);
    if (data.success) {
      const updates = data.data.stages.map(stage => 
        prisma.stage.update({
          where: { id: stage.id, pipelineId: req.params.id },
          data: { order: stage.order }
        })
      );
      await prisma.$transaction(updates);
      return res.json({ success: true });
    }
    
    // Otherwise update pipeline details (name, etc)
    const pipeData = PipelineSchema.partial().parse(req.body);
    const updated = await prisma.pipeline.update({
      where: { id: req.params.id },
      data: pipeData
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.errors || 'Invalid data' });
  }
});

// POST /api/leads/:id/stage - Move lead to new stage (Drag & Drop)
router.post('/leads/:id/stage', async (req, res) => {
  try {
    const { pipelineId, stageId } = MoveLeadSchema.parse(req.body);
    const leadId = parseInt(req.params.id, 10);
    
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { pipelineId, stageId }
    });

    // Create a LeadLog to track stage movements (legacy)
    await prisma.leadLog.create({
      data: {
        leadId,
        action: 'moved_stage',
        field: 'stageId',
        newValue: stageId
      }
    });

    // Create a System Activity
    const stage = await prisma.stage.findUnique({ where: { id: stageId } });
    if (stage) {
      await prisma.activity.create({
        data: {
          leadId,
          type: 'system',
          outcome: 'Stage Changed',
          notes: `Moved to stage: ${stage.name}`,
          isDone: true
        }
      });
    }

    res.json(updatedLead);
  } catch (error) {
    res.status(400).json({ error: error.errors || 'Invalid request' });
  }
});

// GET /api/crm/kanban?pipelineId=xxx - Return board columns + leads
router.get('/crm/kanban', async (req, res) => {
  try {
    const { pipelineId } = req.query;
    if (!pipelineId) return res.status(400).json({ error: 'pipelineId is required' });

    const stages = await prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { order: 'asc' },
      include: {
        leads: {
          select: {
            id: true,
            name: true,
            dealValue: true,
            nextFollowUp: true,
            updatedAt: true,
            winProbability: true,
          },
          orderBy: { updatedAt: 'desc' }
        }
      }
    });

    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch kanban data' });
  }
});

module.exports = router;
