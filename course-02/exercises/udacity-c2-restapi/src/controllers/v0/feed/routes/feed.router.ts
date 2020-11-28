import {Router, Request, Response} from 'express';
import {FeedItem} from '../models/FeedItem';
import {requireAuth} from '../../users/routes/auth.router';
import * as AWS from '../../../../aws';

const router: Router = Router();

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
    const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
    items.rows.map((item) => {
        if (item.url) {
            item.url = AWS.getGetSignedUrl(item.url);
        }
    });
    res.send(items);
});

router.get('/:id', async (req: Request, res: Response) => {
    const item = await FeedItem.findByPk(req.params.id);
    if (item !== null) {
        res.send(item);
    } else {
        res.sendStatus(404);
    }
});

// update a specific resource
router.patch('/:id',
    requireAuth,
    async (req: Request, res: Response) => {
        const item = await FeedItem.findByPk(req.params.id);
        if (item !== null) {
            const caption = req.body.caption;
            const url = req.body.url;
            let changed = false;
            // check Caption is valid
            if (caption) {
                item.caption = caption;
                changed = true;
            }

            // check Filename is valid
            if (url) {
                item.url = url;
                changed = true;
            }

            if (changed) {
                await item.save();
            }
            res.send(item);
        } else {
            res.status(404).send('Could not find item');
        }

    });


// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName',
    requireAuth,
    async (req: Request, res: Response) => {
        let {fileName} = req.params;
        const url = AWS.getPutSignedUrl(fileName);
        res.status(201).send({url: url});
    });

// Post meta data and the filename after a file is uploaded 
// NOTE the file name is they key name in the s3 bucket.
// body : {caption: string, fileName: string};
router.post('/',
    requireAuth,
    async (req: Request, res: Response) => {
        const caption = req.body.caption;
        const url = req.body.url;

        // check Caption is valid
        if (!caption) {
            return res.status(400).send({message: 'Caption is required or malformed'});
        }

        // check Filename is valid
        if (!url) {
            return res.status(400).send({message: 'File url is required'});
        }

        const item = await new FeedItem({
            caption: caption,
            url: url
        });

        const saved_item = await item.save();

        saved_item.url = AWS.getGetSignedUrl(saved_item.url);
        res.status(201).send(saved_item);
    });

export const FeedRouter: Router = router;
