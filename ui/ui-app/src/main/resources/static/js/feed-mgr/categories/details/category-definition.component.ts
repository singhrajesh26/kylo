import { Component } from '@angular/core';
import * as _ from "underscore";
import AccessControlService from "../../../services/AccessControlService";
import StateService from "../../../services/StateService";
import { IconPickerDialog } from "../../../common/icon-picker-dialog/icon-picker-dialog.component";
import CategoriesService from "../../services/CategoriesService";
import { FeedSecurityGroups } from "../../services/FeedSecurityGroups";
import { TdDialogService } from "@covalent/core/dialogs";
import { MatSnackBar } from "@angular/material/snack-bar";
import { FeedService } from "../../services/FeedService";
import 'rxjs/add/operator/timeout';
import { ObjectUtils } from '../../../common/utils/object-utils';
import { CloneUtil } from '../../../common/utils/clone-util';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'thinkbig-category-definition',
    templateUrl: 'js/feed-mgr/categories/details/category-definition.html'
})
export class CategoryDefinition {
    /**
     * Manages the Category Definition section of the Category Details page.
     *
     * @constructor
     * @param {AccessControlService} AccessControlService the access control service
     * @param CategoriesService the category service
     * @param StateService the URL service
     * @param FeedSecurityGroups the feed security groups service
     * @param FeedService the feed service
     */

        /**
         * The Angular form for validation
         * @type {{}}
         */
        categoryForm:any = {};


        /**
         * Indicates if the category definition may be edited.
         * @type {boolean}
         */
        allowEdit:boolean = false;

        /**
         * Indicates the user has the permission to delete
         * @type {boolean}
         */
        allowDelete:boolean = false;

        /**
         * Category data used in "edit" mode.
         * @type {CategoryModel}
         */
        editModel:any;

        /**
         * Indicates if the view is in "edit" mode.
         * @type {boolean} {@code true} if in "edit" mode or {@code false} if in "normal" mode
         */
        isEditable:any;

        /**
         * Category data used in "normal" mode.
         * @type {CategoryModel}
         */
        model:any;

        categorySecurityGroups:any;
        securityGroupChips:any;
        securityGroupsEnabled:boolean = false;
        systemNameEditable:boolean = false;
        /**
         * Prevent users from creating categories with these names
         * @type {string[]}
         */
        reservedCategoryNames:any = ['thinkbig']

        ngOnInit() {

            this.editModel = CloneUtil.deepCopy(this.CategoriesService.model);

            this.isEditable = !ObjectUtils.isString(this.CategoriesService.model.id);

            this.model = this.CategoriesService.model;

            this.categorySecurityGroups = this.FeedSecurityGroups;
            this.securityGroupChips = {};
            this.securityGroupChips.selectedItem = null;
            this.securityGroupChips.searchText = null;

            this.FeedSecurityGroups.isEnabled().then( (isValid:any) => {
                    this.securityGroupsEnabled = isValid;
                }
            );

            this.checkAccessPermissions();

            // Fetch the existing categories
            this.CategoriesService.reload().subscribe((response:any) =>{
                if (this.editModel) {
                    this.validateDisplayName();
                    this.validateSystemName();
                }
            });
        }

        constructor(private accessControlService:AccessControlService,
                private CategoriesService: CategoriesService,
                private StateService:StateService,
                private FeedSecurityGroups: FeedSecurityGroups,
                private feedService : FeedService,
                private _tdDialogService: TdDialogService,
                private snackBar : MatSnackBar,
                private translate : TranslateService) {}

    /**
         * System Name states:
         * !new 0, !editable 0, !feeds 0 - not auto generated, can change
         * !new 0, !editable 0,  feeds 1 - not auto generated, cannot change
         * !new 0,  editable 1, !feeds 0 - not auto generated, editable
         * !new 0,  editable 1,  feeds 1 - invalid state (cannot be editable with feeds)
         *  new 1, !editable 0, !feeds 0 - auto generated, can change
         *  new 1, !editable 0,  feeds 1 - invalid state (new cannot be with feeds)
         *  new 1,  editable 1, !feeds 0 - not auto generated, editable
         *  new 1,  editable 1,  feeds 1 - invalid state (cannot be editable with feeds)
         */
        getSystemNameDescription () {
            // console.log("this.isNewCategory() = " + this.isNewCategory());
            // console.log("this.isSystemNameEditable() = " + this.isSystemNameEditable());
            // console.log("this.hasFeeds() = " + this.hasFeeds());

            if (!this.isNewCategory() && !this.isSystemNameEditable() && this.hasNoFeeds()) {
                return this.translate.instant('FEEDMGR.CATEGORY.DEFINITION_SYSTEM_NAME.CUSTOMIZABLE');
            }
            if (!this.isNewCategory() && !this.isSystemNameEditable() && this.hasFeeds()) {
                return this.translate.instant('FEEDMGR.CATEGORY.DEFINITION_SYSTEM_NAME.NOT_CUSTOMIZABLE_HAS_FEEDS');
            }
            if (!this.isNewCategory() && this.isSystemNameEditable() && this.hasNoFeeds()) {
                return this.translate.instant('FEEDMGR.CATEGORY.DEFINITION_SYSTEM_NAME.NOW_EDITABLE');
            }
            if (!this.isNewCategory() && this.isSystemNameEditable() && this.hasFeeds()) {
                return ""; //invalid state, cannot be both editable and have feeds!
            }
            if (this.isNewCategory() && !this.isSystemNameEditable() && this.hasNoFeeds()) {
                return this.translate.instant('FEEDMGR.CATEGORY.DEFINITION_SYSTEM_NAME.NOT_CUSTOMIZABLE_AUTO_GENERATED');
            }
            if (this.isNewCategory() && !this.isSystemNameEditable() && this.hasFeeds()) {
                return ""; //invalid state, cannot be new and already have feeds
            }
            if (this.isNewCategory() && this.isSystemNameEditable() && this.hasNoFeeds()) {
                return this.translate.instant('FEEDMGR.CATEGORY.DEFINITION_SYSTEM_NAME.NOW_EDITABLE');
            }
            if (this.isNewCategory() && this.isSystemNameEditable() && this.hasFeeds()) {
                return ""; //invalid state, cannot be new with feeds
            }
            return "";
        };

        isNewCategory () {
            return this.editModel.id == undefined;
        };

        isSystemNameEditable () {
            return this.systemNameEditable;
        };

        hasFeeds () {
            return !this.hasNoFeeds();
        };

        hasNoFeeds () {
            return (!Array.isArray(this.model.relatedFeedSummaries) || this.model.relatedFeedSummaries.length === 0);
        };

        allowEditSystemName () {
            this.systemNameEditable = true;
            setTimeout(() => {
                var systemNameInput = window.document.getElementById("systemName");
                if(systemNameInput) {
                    systemNameInput.focus();
                }
            }, 1000);
        };

        splitSecurityGroups () {
            if (this.model.securityGroups) {
                return _.map(this.model.securityGroups, (securityGroup:any) =>{
                    return securityGroup.name
                }).join(",");
            }
        };

        /**
         * Indicates if the category can be deleted.
         * @return {boolean} {@code true} if the category can be deleted, or {@code false} otherwise
         */
        canDelete () {
            return this.allowDelete && (ObjectUtils.isString(this.model.id) && this.hasNoFeeds());
        };

        /**
         * Returns to the category list page if creating a new category.
         */
        onCancel () {
            this.systemNameEditable = false;
            if (!ObjectUtils.isString(this.model.id)) {
                this.StateService.FeedManager().Category().navigateToCategories();
            }
        };

        /**
         * Deletes this category.
         */
        onDelete () {
            var name = this.editModel.name;
            this.CategoriesService.delete(this.editModel).then( () => {
                this.systemNameEditable = false;
                this.CategoriesService.reload();
                this.snackBar.open(this.translate.instant('FEEDMGR.CATEGORY.DELETED') + name, this.translate.instant('view.main.ok'), {duration : 3000});
                //redirect
                this.StateService.FeedManager().Category().navigateToCategories();
            }, (err:any) => {
                this._tdDialogService.openAlert({
                    message : this.translate.instant('FEEDMGR.CATEGORY.DIALOG.DELETE_FAILED_MESSAGE',{entity: name, message: err.message}),
                    title : this.translate.instant('views.common.delete.failure.title'),
                    ariaLabel : this.translate.instant('views.common.delete.failure',{entity:'Category'}),
                    closeButton : this.translate.instant('views.common.dialog.gotIt'),
                    disableClose : false
                });
            }); 
        };

        /**
         * Switches to "edit" mode.
         */
        onEdit () {
            this.editModel = CloneUtil.deepCopy(this.model);
        };

        /**
         * Check for duplicate display and system names.
         */
        validateDisplayAndSystemName () {
            var displayNameExists = false;
            var systemNameExists = false;
            var newDisplayName = this.editModel.name;

            this.feedService.getSystemName(newDisplayName)
                .then( (response:any) =>{
                    var systemName = response;
                    if (this.isNewCategory() && !this.isSystemNameEditable()) {
                        this.editModel.systemName = systemName;
                    }

                    displayNameExists = _.some(this.CategoriesService.categories, (category:any) =>{
                        return  (this.editModel.id == null || (this.editModel.id != null && category.id != this.editModel.id)) && category.name === newDisplayName;
                    });

                    systemNameExists = _.some(this.CategoriesService.categories, (category:any) =>{
                        return  (this.editModel.id == null || (this.editModel.id != null && category.id != this.editModel.id)) && category.systemName === this.editModel.systemName;
                    });

                    var reservedCategoryDisplayName = newDisplayName && _.indexOf(this.reservedCategoryNames, newDisplayName.toLowerCase()) >= 0;
                    var reservedCategorySystemName = this.editModel.systemName && _.indexOf(this.reservedCategoryNames, this.editModel.systemName.toLowerCase()) >= 0;

                    if (this.categoryForm) {
                        if (this.categoryForm['categoryName']) {
                            this.categoryForm['categoryName'].$setValidity('duplicateDisplayName', !displayNameExists);
                            this.categoryForm['categoryName'].$setValidity('reservedCategoryName', !reservedCategoryDisplayName);
                        }
                        if (this.categoryForm['systemName']) {
                            this.categoryForm['systemName'].$setValidity('duplicateSystemName', !systemNameExists);
                            this.categoryForm['systemName'].$setValidity('reservedCategoryName', !reservedCategorySystemName);
                        }
                    }
                });
        };

        /**
         * Check for duplicate display and system names.
         */
        validateDisplayName () {
            var nameExists = false;
            var newName = this.editModel.name;

            this.feedService.getSystemName(newName)
                .then((response:any) =>{
                    var systemName = response;
                    if (this.isNewCategory() && !this.isSystemNameEditable()) {
                        this.editModel.systemName = systemName;
                    }

                    nameExists = _.some(this.CategoriesService.categories, (category:any) =>{
                        return  (this.editModel.id == null || (this.editModel.id != null && category.id != this.editModel.id)) && category.name === newName;
                    });

                    var reservedCategoryDisplayName = newName && _.indexOf(this.reservedCategoryNames, newName.toLowerCase()) >= 0;

                    if (this.categoryForm) {
                        if (this.categoryForm['categoryName']) {
                            this.categoryForm['categoryName'].$setValidity('duplicateDisplayName', !nameExists);
                            this.categoryForm['categoryName'].$setValidity('reservedCategoryName', !reservedCategoryDisplayName);
                        }
                    }
                });
        };

        /**
         * Check for duplicate display and system names.
         */
        validateSystemName () {
            var nameExists = false;
            var newName = this.editModel.systemName;

            this.feedService.getSystemName(newName)
                .then((response:any) =>{
                    var systemName = response;

                    nameExists = _.some(this.CategoriesService.categories, (category:any) =>{
                        return  (this.editModel.id == null || (this.editModel.id != null && category.id != this.editModel.id)) && category.systemName === systemName;
                    });

                    var reservedCategorySystemName = this.editModel.systemName && _.indexOf(this.reservedCategoryNames, this.editModel.systemName.toLowerCase()) >= 0;
                    var invalidName = newName !== systemName;
                    if (this.categoryForm) {
                        if (this.categoryForm['systemName']) {
                            this.categoryForm['systemName'].$setValidity('invalidName', !invalidName);
                            this.categoryForm['systemName'].$setValidity('duplicateSystemName', !nameExists);
                            this.categoryForm['systemName'].$setValidity('reservedCategoryName', !reservedCategorySystemName);
                        }
                    }
                });
        };

        /**
         * Saves the category definition.
         */
        onSave () {
            this.model = CloneUtil.deepCopy(this.editModel);
            var model = CloneUtil.deepCopy(this.CategoriesService.model);
            model.name = this.editModel.name;
            model.systemName = this.editModel.systemName;
            model.description = this.editModel.description;
            model.icon = this.editModel.icon;
            model.iconColor = this.editModel.iconColor;
            model.userProperties = (this.model.id === null) ? this.editModel.userProperties : null;
            model.securityGroups = this.editModel.securityGroups;
            model.allowIndexing = this.editModel.allowIndexing;

            this.CategoriesService.save(model).then((response:any) =>{
                this.systemNameEditable = false;
                this.CategoriesService.update(response);
                this.model = this.CategoriesService.model = response;
                this.snackBar.open('Saved the Category', 'OK', {duration : 3000});
                this.checkAccessPermissions();
            }, (err:any) =>{
                this._tdDialogService.openAlert({
                    message : "The category '" + model.name + "' could not be saved. " + err.message,
                    ariaLabel : "Failed to save category",
                    title : "Save Failed",
                    disableClose : false,
                    closeButton : "Got it!"
                });
            });
        };

        /**
         * Shows the icon picker dialog.
         */
        showIconPicker () {

            let dialogRef = this._tdDialogService.open(IconPickerDialog, {
                data: { iconModel: this.editModel },
                panelClass: "full-screen-dialog"
              });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.editModel.icon = result.icon;
                    this.editModel.iconColor = result.color;
                }
            });

        };

        getIconColorStyle (iconColor:any) {
            return  {'fill': iconColor};
        };

        checkAccessPermissions () {
            // Apply the entity access permissions
            this.accessControlService.hasPermission(AccessControlService.CATEGORIES_EDIT, this.model, AccessControlService.ENTITY_ACCESS.CATEGORY.EDIT_CATEGORY_DETAILS).then((access:any) =>{
                this.allowEdit = access;
            });

            this.accessControlService.hasPermission(AccessControlService.CATEGORIES_EDIT, this.model, AccessControlService.ENTITY_ACCESS.CATEGORY.DELETE_CATEGORY).then((access:any) =>{
                this.allowDelete = access;
            });
        }
    }
